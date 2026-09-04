// §12 Agent 内核：浏览器端 loop 运行时（自研六项契约）。
// 设计取舍见 features.md §12：
// - AgentTool: content 给模型 / details 只给 UI
// - beforeToolCall 钩子承担批准机制（写工具被拦下，批准才放行）
// - replay: 读 safe / 写 never（用户点停止时的处置依据）
// - steering / follow-up 队列：运行中可继续输入
// 非目标：崩溃恢复、多租户、断流重连。

export interface ToolContent {
  type: "text";
  text: string;
}

export interface AgentToolResult<TDetails = unknown> {
  content: ToolContent[];
  /** 结构化数据只给 UI（diff/命中列表），模型看不到 */
  details: TDetails;
}

export interface AgentTool<TDetails = unknown> {
  name: string;
  label: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** 读工具 safe（可重跑）/ 写工具 never（停止即丢弃，不补跑） */
  replay: "safe" | "never";
  execute: (params: Record<string, unknown>, ctx: ToolCtx) => Promise<AgentToolResult<TDetails>>;
}

export interface ToolCtx {
  signal?: AbortSignal;
  onUpdate?: (partial: AgentToolResult) => void;
}

export interface BeforeToolCallCtx {
  tool: AgentTool;
  args: Record<string, unknown>;
}

export interface BeforeToolCallResult {
  block?: boolean;
  reason?: string;
}

// §12 事件流：UI 只订阅事件，不猜状态
export type AgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end"; reason: "done" | "aborted" | "error"; error?: string }
  | { type: "turn_start"; turn: number }
  | { type: "turn_end"; turn: number }
  | { type: "assistant_message"; text: string }
  | { type: "tool_start"; callId: string; name: string; args: Record<string, unknown> }
  | { type: "tool_update"; callId: string; name: string; partial: unknown }
  | { type: "tool_end"; callId: string; name: string; result: AgentToolResult; isError: boolean; blockedReason?: string }
  | { type: "steering_queued"; text: string };

export type EventEmitter = (event: AgentEvent) => void;

// 浏览器端消息形状：与 OpenAI chat 协议对齐，/api/agent 只做透传
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface AgentRunConfig {
  systemPrompt: string;
  tools: AgentTool[];
  messages: ChatMessage[];
  maxTurns?: number;
  /** 批准机制：返回 block=true 则不执行，reason 作为 error tool result 回给模型 */
  beforeToolCall?: (ctx: BeforeToolCallCtx) => Promise<BeforeToolCallResult | undefined>;
  emit: EventEmitter;
  signal?: AbortSignal;
  /** steering：每轮工具结束后注入的追加消息 */
  getSteeringMessages?: () => Promise<ChatMessage[]>;
  /** follow-up：本要停下时若有消息则继续 */
  getFollowUpMessages?: () => Promise<ChatMessage[]>;
}

/** 驱动一次 agent run。messages 原地追加，调用方持有完整 transcript。 */
export async function runAgent(config: AgentRunConfig): Promise<void> {
  const { emit, signal } = config;
  const maxTurns = config.maxTurns ?? 12;
  const tools = config.tools;

  emit({ type: "agent_start" });

  try {
    for (let turn = 1; turn <= maxTurns; turn++) {
      if (signal?.aborted) break;
      emit({ type: "turn_start", turn });

      const response = await callLLM(config);
      config.messages.push({
        role: "assistant",
        content: response.content,
        ...(response.toolCalls.length > 0
          ? {
              tool_calls: response.toolCalls.map((c) => ({
                id: c.id,
                type: "function" as const,
                function: { name: c.name, arguments: c.arguments },
              })),
            }
          : {}),
      });

      if (response.content) emit({ type: "assistant_message", text: response.content });

      const calls = response.toolCalls;
      if (calls.length === 0) {
        // 本要停下：看 follow-up 有没有排队消息
        const followUps = (await config.getFollowUpMessages?.()) ?? [];
        if (followUps.length > 0 && !signal?.aborted) {
          config.messages.push(...followUps);
          emit({ type: "turn_end", turn });
          continue;
        }
        emit({ type: "turn_end", turn });
        break;
      }

      for (const call of calls) {
        if (signal?.aborted) break;
        const tool = tools.find((t) => t.name === call.name);
        emit({ type: "tool_start", callId: call.id, name: call.name, args: call.parsed });

        if (!tool) {
          const err = { content: [{ type: "text" as const, text: `Unknown tool: ${call.name}` }], details: {} };
          config.messages.push({ role: "tool", tool_call_id: call.id, content: `Unknown tool: ${call.name}` });
          emit({ type: "tool_end", callId: call.id, name: call.name, result: err, isError: true });
          continue;
        }

        // §12.3 批准机制：钩子拦截写工具
        const gate = await config.beforeToolCall?.({ tool, args: call.parsed });
        if (gate?.block) {
          const reason = gate.reason ?? "Blocked by user";
          const err = { content: [{ type: "text" as const, text: `Blocked: ${reason}` }], details: { blocked: true, reason } };
          config.messages.push({ role: "tool", tool_call_id: call.id, content: `Blocked: ${reason}` });
          emit({ type: "tool_end", callId: call.id, name: call.name, result: err, isError: true, blockedReason: reason });
          continue;
        }

        try {
          const result = await tool.execute(call.parsed, {
            signal,
            onUpdate: (partial) => emit({ type: "tool_update", callId: call.id, name: call.name, partial: partial.details }),
          });
          config.messages.push({ role: "tool", tool_call_id: call.id, content: stringifyForModel(result) });
          emit({ type: "tool_end", callId: call.id, name: call.name, result, isError: false });
        } catch (e) {
          if (signal?.aborted) break; // 停止导致的异常直接收尾
          const msg = e instanceof Error ? e.message : String(e);
          const err = { content: [{ type: "text" as const, text: `Error: ${msg}` }], details: { error: msg } };
          config.messages.push({ role: "tool", tool_call_id: call.id, content: `Error: ${msg}` });
          emit({ type: "tool_end", callId: call.id, name: call.name, result: err, isError: true });
        }
      }

      emit({ type: "turn_end", turn });

      // steering：每轮工具结束后注入
      const steering = (await config.getSteeringMessages?.()) ?? [];
      if (steering.length > 0) config.messages.push(...steering);
    }

    emit({ type: "agent_end", reason: signal?.aborted ? "aborted" : "done" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emit({ type: "agent_end", reason: "error", error: msg });
  }
}

interface LLMResponse {
  content: string;
  toolCalls: { id: string; name: string; parsed: Record<string, unknown>; arguments: string }[];
}

async function callLLM(config: AgentRunConfig): Promise<LLMResponse> {
  // /api/agent 是纯代理：注入 key、转发消息与工具 schema，返回 OpenAI 协议响应
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: config.messages,
      tools: config.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
    }),
    signal: config.signal,
  });

  if (!res.ok) {
    throw new Error(`/api/agent ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  // turn 粒度的过程可视已经由工具事件承担（demo 取舍：不做逐字流），
  // 后续要加也只是把这里换成流式解析
  const data = (await res.json()) as {
    content: string;
    tool_calls?: { id: string; function: { name: string; arguments: string } }[];
  };

  const toolCalls = (data.tool_calls ?? []).map((c) => ({
    id: c.id,
    name: c.function.name,
    arguments: c.function.arguments,
    parsed: safeParse(c.function.arguments),
  }));

  return { content: data.content ?? "", toolCalls };
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** content 发给模型；details 留在 UI，不进上下文（省 token 且防止模型复读结构化数据） */
function stringifyForModel(result: AgentToolResult): string {
  return result.content.map((c) => c.text).join("\n");
}
