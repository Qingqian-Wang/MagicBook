import { describe, expect, it, vi } from "vitest";
import { runAgent, type AgentEvent, type AgentTool, type ChatMessage } from "../src/agent/agent-loop";

// 假 LLM：脚本化每轮返回值（text + 工具调用）
function makeFakeLLM(script: { content: string; toolCalls?: { id: string; name: string; args: string }[] }[]) {
  let i = 0;
  return async () => {
    const step = script[Math.min(i++, script.length - 1)];
    return {
      content: step.content,
      toolCalls: step.toolCalls ?? [],
    };
  };
}

// 替换 fetch：只拦截 /api/agent
function stubFetch(llm: () => Promise<{ content: string; toolCalls: { id: string; name: string; args: string }[] }>) {
  const orig = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/agent")) {
        const r = await llm();
        return {
          ok: true,
          status: 200,
          json: async () => ({
            content: r.content,
            tool_calls: r.toolCalls.map((c) => ({
              id: c.id,
              function: { name: c.name, arguments: c.args },
            })),
          }),
          text: async () => "",
        } as unknown as Response;
      }
      return orig(url);
    }),
  );
  return () => vi.unstubAllGlobals();
}

const echoTool: AgentTool = {
  name: "echo",
  label: "回声",
  description: "test",
  replay: "safe",
  parameters: { type: "object", properties: {} },
  execute: async (params) => ({
    content: [{ type: "text", text: `echo:${JSON.stringify(params)}` }],
    details: { ui: "echo" },
  }),
};

describe("runAgent", () => {
  it("完整事件序列：start → turn → tool → assistant → end", async () => {
    const un = stubFetch(
      makeFakeLLM([
        { content: "", toolCalls: [{ id: "t1", name: "echo", args: "{}" }] },
        { content: "done" },
      ]) as never,
    );
    const events: AgentEvent[] = [];
    const messages: ChatMessage[] = [{ role: "user", content: "hi" }];

    await runAgent({
      systemPrompt: "s",
      tools: [echoTool],
      messages,
      emit: (e) => events.push(e),
    });
    un();

    const types = events.map((e) => e.type);
    expect(types[0]).toBe("agent_start");
    expect(types).toContain("tool_start");
    expect(types).toContain("tool_end");
    expect(types).toContain("assistant_message");
    expect(types[types.length - 1]).toBe("agent_end");
    // transcript 完整：user / assistant(带 tool_calls) / tool / assistant
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "tool", "assistant"]);
    expect(messages[1].tool_calls?.[0].function.name).toBe("echo");
    expect(messages[2].tool_call_id).toBe("t1");
    // details 不进模型上下文，只有 content 文本
    expect(messages[2].content).toBe("echo:{}");
  });

  it("批准机制：beforeToolCall block 后模型收到 error result 且工具未执行", async () => {
    const executed = vi.fn();
    const writeTool: AgentTool = { ...echoTool, name: "writeDoc", replay: "never", execute: async (p) => { executed(); return echoTool.execute(p, {}); } };
    const un = stubFetch(
      makeFakeLLM([
        { content: "", toolCalls: [{ id: "w1", name: "writeDoc", args: '{"x":1}' }] },
        { content: "被拒了，收工" },
      ]) as never,
    );
    const events: AgentEvent[] = [];
    const messages: ChatMessage[] = [{ role: "user", content: "go" }];

    await runAgent({
      systemPrompt: "s",
      tools: [writeTool],
      messages,
      emit: (e) => events.push(e),
      beforeToolCall: async () => ({ block: true, reason: "user rejected" }),
    });
    un();

    expect(executed).not.toHaveBeenCalled();
    const toolEnd = events.find((e) => e.type === "tool_end") as Extract<AgentEvent, { type: "tool_end" }>;
    expect(toolEnd.isError).toBe(true);
    expect(toolEnd.blockedReason).toBe("user rejected");
    expect(messages[2].content).toBe("Blocked: user rejected");
  });

  it("steering：停下前 follow-up 队列有消息则继续一轮", async () => {
    const un = stubFetch(
      makeFakeLLM([
        { content: "first" },
        { content: "second" },
      ]) as never,
    );
    const messages: ChatMessage[] = [{ role: "user", content: "q" }];
    let followUps = [{ role: "user" as const, content: "再答一次" }];

    await runAgent({
      systemPrompt: "s",
      tools: [],
      messages,
      emit: () => {},
      getFollowUpMessages: async () => {
        const q = followUps;
        followUps = [];
        return q;
      },
    });
    un();

    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(messages[2].content).toBe("再答一次");
  });

  it("maxTurns 兜底", async () => {
    let n = 0;
    const un = stubFetch(async () => {
      n++;
      return { content: `turn${n}`, toolCalls: [{ id: `t${n}`, name: "echo", args: "{}" }] };
    });
    const messages: ChatMessage[] = [{ role: "user", content: "loop" }];
    await runAgent({
      systemPrompt: "s",
      tools: [echoTool],
      messages,
      maxTurns: 3,
      emit: () => {},
    });
    un();
    // 3 轮 = 3 条 assistant
    expect(messages.filter((m) => m.role === "assistant").length).toBe(3);
  });
});
