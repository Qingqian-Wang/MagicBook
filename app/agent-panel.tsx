"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Send, Square, X } from "lucide-react";
import MarkdownIt from "markdown-it";

// Agent 回复渲染：markdown-it（linkify 让裸 URL 自动成链接），外部链接新窗口打开。
const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false });
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  tokens[idx].attrSet("target", "_blank");
  tokens[idx].attrSet("rel", "noopener noreferrer");
  return self.renderToken(tokens, idx, options);
};
import {
  type AgentEvent,
  type ChatMessage,
  type TaskKind,
  type WriteProposal,
  makeWikiTools,
  runAgent,
  taskPrompts,
} from "@magicbook/editor";

// §14 右栏 Agent 面板：任务选择 + 对话流（工具步骤可视）+ 提议卡片 + steering 输入。
// 事件流 → UI 的映射全部在这里；批准机制 = makeWikiTools 的 approveWrite 回调弹卡片。

interface StepItem {
  key: string;
  kind: "tool" | "assistant" | "proposal";
  name?: string;
  args?: Record<string, unknown>;
  status: "running" | "done" | "error" | "blocked" | "pending";
  text?: string;
  proposal?: WriteProposal;
}

export function AgentPanel({
  onDocsChanged,
  seed,
  preset,
  wide,
}: {
  onDocsChanged: () => void;
  /** 气泡菜单「Ask AI」发来的预填（text + 触发序号） */
  seed?: { text: string; n: number } | null;
  /** 首页任务卡召唤：切换到的任务 tab（task + 触发序号） */
  preset?: { task: TaskKind; n: number } | null;
  /** 未打开文档（首页）时面板加宽 */
  wide?: boolean;
}) {
  const [task, setTask] = useState<TaskKind>("ask");
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const steeringRef = useRef<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [steps]);

  // 气泡菜单入口：预填 Ask 任务输入框
  useEffect(() => {
    if (!seed?.text) return;
    setTask("ask");
    setInput(seed.text);
  }, [seed?.n]);

  // 首页任务卡召唤：切换任务 tab 并聚焦输入框
  useEffect(() => {
    if (!preset?.task) return;
    setTask(preset.task);
    inputRef.current?.focus();
  }, [preset?.n]);

  const pushStep = (s: StepItem) => setSteps((prev) => [...prev, s]);
  const patchStep = (key: string, patch: Partial<StepItem>) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  /** 批准机制：写工具调用 → 弹卡片 → 等用户点击。拒绝返回 false，reason 由工具回给模型 */
  const approveWrite = useCallback((proposal: WriteProposal): Promise<boolean> => {
    return new Promise((resolve) => {
      const key = `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      pushStep({ key, kind: "proposal", status: "pending", proposal });
      // 挂 resolve 到窗口，由按钮调用
      (window as unknown as Record<string, unknown>)[`__mb_resolve_${key}`] = resolve;
    });
  }, []);

  const decide = (key: string, approved: boolean) => {
    const resolve = (window as unknown as Record<string, (v: boolean) => void>)[`__mb_resolve_${key}`];
    patchStep(key, { status: approved ? "done" : "blocked" });
    if (resolve) {
      resolve(approved);
      delete (window as unknown as Record<string, unknown>)[`__mb_resolve_${key}`];
    }
  };

  const start = async () => {
    const text = input.trim();
    if (!text || running) return;
    const def = taskPrompts[task];

    setRunning(true);
    setError(null);
    setSteps([{ key: "start", kind: "assistant", status: "done", text: `▶ ${def.label}` }]);
    messagesRef.current = [
      { role: "system", content: def.systemPrompt },
      { role: "user", content: def.wrapInput(text) },
    ];
    setInput("");

    const controller = new AbortController();
    abortRef.current = controller;

    const tools = makeWikiTools({ approveWrite });

    const emit = (e: AgentEvent) => {
      switch (e.type) {
        case "turn_start":
          break;
        case "assistant_message":
          pushStep({ key: `a-${e.text.length}-${Math.random().toString(36).slice(2, 6)}`, kind: "assistant", status: "done", text: e.text });
          break;
        case "tool_start":
          pushStep({ key: e.callId, kind: "tool", name: e.name, args: e.args, status: "running" });
          break;
        case "tool_update":
          patchStep(e.callId, { status: "running" });
          break;
        case "tool_end":
          if (e.blockedReason) patchStep(e.callId, { status: "blocked" });
          else patchStep(e.callId, { status: e.isError ? "error" : "done" });
          break;
        case "steering_queued":
          pushStep({ key: `s-${Date.now()}`, kind: "assistant", status: "done", text: `↳ 已排队：${e.text}` });
          break;
        case "agent_end":
          if (e.reason === "error") setError(e.error ?? "agent 出错");
          break;
      }
    };

    await runAgent({
      systemPrompt: def.systemPrompt,
      tools,
      messages: messagesRef.current,
      emit,
      signal: controller.signal,
      getSteeringMessages: async () => {
        const queued = steeringRef.current;
        steeringRef.current = [];
        return queued.map((t) => ({ role: "user" as const, content: t }));
      },
      getFollowUpMessages: async () => {
        const queued = steeringRef.current;
        steeringRef.current = [];
        return queued.map((t) => ({ role: "user" as const, content: t }));
      },
    });

    setRunning(false);
    abortRef.current = null;
    onDocsChanged();
  };

  const stop = () => abortRef.current?.abort();

  const sendSteering = () => {
    const text = input.trim();
    if (!text || !running) return;
    steeringRef.current.push(text);
    setInput("");
    emitLocal({ type: "steering_queued", text });
  };

  const emitLocal = (e: AgentEvent) => {
    if (e.type === "steering_queued")
      pushStep({ key: `s-${Date.now()}`, kind: "assistant", status: "done", text: `↳ 已排队：${e.text}` });
  };

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-l border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900 ${
        wide ? "w-96 lg:w-[30rem]" : "w-96"
      }`}
    >
      <div className="flex gap-1 border-b border-stone-200 p-2 dark:border-stone-700">
        {(Object.keys(taskPrompts) as TaskKind[]).map((k) => (
          <button
            key={k}
            type="button"
            disabled={running}
            onClick={() => setTask(k)}
            className={`flex-1 rounded-md px-2 py-1 text-xs ${
              task === k
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                : "text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
            } disabled:opacity-50`}
          >
            {taskPrompts[k].label}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {steps.length === 0 && (
          <p className="text-sm text-stone-400">选一个任务，输入内容开始。Agent 的每一步都会显示在这里。</p>
        )}
        {steps.map((s) => (
          <StepView key={s.key} step={s} onDecide={decide} />
        ))}
        {error && <div className="rounded-md bg-red-50 p-2 text-xs text-red-600">{error}</div>}
      </div>

      <div className="border-t border-stone-200 p-2 dark:border-stone-700">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (running) sendSteering();
                else void start();
              }
            }}
            rows={3}
            placeholder={running ? "运行中… 输入即追加指令（steering）" : taskPrompts[task].placeholder}
            className="w-full resize-none rounded-md border border-stone-200 bg-white p-2 pr-16 text-sm outline-none focus:border-stone-400 dark:border-stone-700 dark:bg-stone-800"
          />
          <div className="absolute bottom-2 right-2 flex gap-1">
            {running ? (
              <button
                type="button"
                onClick={stop}
                aria-label="停止"
                className="rounded-md bg-red-500 p-1.5 text-white hover:bg-red-600"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void start()}
                aria-label="发送"
                className="rounded-md bg-purple-500 p-1.5 text-white hover:bg-purple-600"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {running && (
          <p className="mt-1 flex items-center gap-1 text-xs text-purple-500">
            <Loader2 className="h-3 w-3 animate-spin" /> agent 运行中
          </p>
        )}
      </div>
    </aside>
  );
}

function StepView({ step, onDecide }: { step: StepItem; onDecide: (key: string, approved: boolean) => void }) {
  if (step.kind === "proposal" && step.proposal) {
    const p = step.proposal;
    const label = p.kind === "create" ? "新建" : p.kind === "update" ? "修改" : "删除";
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm dark:border-amber-700 dark:bg-amber-900/30">
        <div className="mb-1 font-medium text-amber-800 dark:text-amber-300">
          提议 · {label}《{p.title}》{p.reason ? ` — ${p.reason}` : ""}
        </div>
        {p.markdown && (
          <pre className="mb-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">
            {p.markdown.slice(0, 800)}
            {p.markdown.length > 800 ? "\n…" : ""}
          </pre>
        )}
        {p.kind === "update" && p.oldMarkdown && (
          <details className="mb-2 text-xs text-stone-500">
            <summary>原内容</summary>
            <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap">{p.oldMarkdown.slice(0, 600)}</pre>
          </details>
        )}
        {step.status === "pending" ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onDecide(step.key, true)}
              className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
            >
              <Check className="h-3 w-3" /> 批准
            </button>
            <button
              type="button"
              onClick={() => onDecide(step.key, false)}
              className="flex items-center gap-1 rounded bg-stone-200 px-2 py-1 text-xs text-stone-600 hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-300"
            >
              <X className="h-3 w-3" /> 拒绝
            </button>
          </div>
        ) : (
          <div className={`text-xs ${step.status === "done" ? "text-emerald-600" : "text-stone-400"}`}>
            {step.status === "done" ? "已批准并执行" : "已拒绝"}
          </div>
        )}
      </div>
    );
  }

  if (step.kind === "tool") {
    const icon =
      step.status === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : null;
    const color =
      step.status === "error"
        ? "text-red-500"
        : step.status === "blocked"
          ? "text-stone-400"
          : "text-emerald-600";
    return (
      <div className="flex items-center gap-1.5 text-xs">
        {icon}
        <span className={color}>⚙ {step.name}</span>
        <span className="truncate text-stone-400">{summarizeArgs(step.args)}</span>
        {step.status === "error" && <span className="text-red-500">失败</span>}
        {step.status === "blocked" && <span className="text-stone-400">被拒</span>}
      </div>
    );
  }

  return (
    <div className="rounded-md bg-stone-50 p-2 text-sm text-stone-800 dark:bg-stone-800 dark:text-stone-200">
      <div
        className="[&_p]:my-1.5 [&_h1]:my-1 [&_h2]:my-1 [&_h3]:my-1 [&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_strong]:font-semibold [&_ul]:my-1 [&_ol]:my-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5 [&_li]:pl-1 [&_a]:text-purple-600 [&_a]:underline dark:[&_a]:text-purple-400 [&_a]:break-all [&_code]:rounded [&_code]:bg-stone-200 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_code]:font-mono dark:[&_code]:bg-stone-700 [&_pre]:my-1.5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-stone-900 [&_pre]:p-2 [&_pre]:text-xs [&_pre]:text-stone-100 [&_blockquote]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-stone-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-stone-500 dark:[&_blockquote]:border-stone-600 [&_hr]:my-2 [&_table]:my-1 [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_table]:border-collapse [&_td]:border [&_th]:border [&_td]:border-stone-300 [&_th]:border-stone-300 dark:[&_td]:border-stone-600 dark:[&_th]:border-stone-600 [&_td]:align-top [&_th]:text-left"
        dangerouslySetInnerHTML={{ __html: md.render(step.text ?? "") }}
      />
    </div>
  );
}

function summarizeArgs(args?: Record<string, unknown>): string {
  if (!args) return "";
  const q = (args.query ?? args.title ?? args.id ?? "") as string;
  return typeof q === "string" ? q.slice(0, 40) : "";
}
