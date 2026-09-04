// §13 任务 = 「任务卡」：提示词模板 + 预填输入，不是代码分支。
// 模板改动不需要改这里：tasks.ts 只负责装载 markdown 为字符串。
import askPrompt from "./prompts/ask.md";
import ingestPrompt from "./prompts/ingest.md";
import tidyPrompt from "./prompts/tidy.md";

export type TaskKind = "ask" | "tidy" | "ingest";

export interface TaskDef {
  kind: TaskKind;
  label: string;
  systemPrompt: string;
  /** 预填的用户输入（可编辑） */
  placeholder: string;
  /** 用户输入作为首条 user message 的包装 */
  wrapInput: (input: string) => string;
}

export const taskPrompts: Record<TaskKind, TaskDef> = {
  ask: {
    kind: "ask",
    label: "Ask · 跨文档问答",
    systemPrompt: askPrompt,
    placeholder: "问一个知识库相关问题，如「React 如何快速上手」",
    wrapInput: (input) => input,
  },
  tidy: {
    kind: "tidy",
    label: "Tidy · 整理",
    systemPrompt: tidyPrompt,
    placeholder: "整理哪篇？留空 = 全库整理",
    wrapInput: (input) => (input.trim() ? `请整理：${input}` : "请整理整个知识库"),
  },
  ingest: {
    kind: "ingest",
    label: "Ingest · 长文蒸馏",
    systemPrompt: ingestPrompt,
    placeholder: "粘贴要蒸馏的长文本…",
    wrapInput: (input) => `请把下面的内容蒸馏成原子笔记：\n\n${input}`,
  },
};
