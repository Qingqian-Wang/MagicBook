"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { docStore, type TaskKind, type WikiDoc } from "@magicbook/editor";
import { Sidebar } from "./sidebar";
import { AgentPanel } from "./agent-panel";

// 应用壳（§14 三栏）：左 = 文档列表；中 = 内容区；右 = Agent 面板。
// 文档列表状态收敛在这里，子页通过回调刷新。
export function Shell({ children, currentId }: { children: ReactNode; currentId?: string }) {
  const [docs, setDocs] = useState<WikiDoc[] | null>(null);
  const [showAgent, setShowAgent] = useState(false);
  // 编辑器气泡菜单「Ask AI」发来的选区文本 → 打开面板并预填 Ask 任务
  const [seed, setSeed] = useState<{ text: string; n: number } | null>(null);
  // 首页任务卡「召唤 Agent」：预设要切换到的任务 tab
  const [preset, setPreset] = useState<{ task: TaskKind; n: number } | null>(null);

  const refresh = useCallback(async () => {
    setDocs(await docStore.list());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onAsk = (e: Event) => {
      const text = (e as CustomEvent<string>).detail ?? "";
      setSeed({ text: `基于这段内容：${text}`, n: Date.now() });
      setShowAgent(true);
    };
    window.addEventListener("mb:ask-ai", onAsk);
    return () => window.removeEventListener("mb:ask-ai", onAsk);
  }, []);

  // 首页任务卡「召唤 Agent」：打开面板并预选 Ask / Tidy / Ingest
  useEffect(() => {
    const onOpenTask = (e: Event) => {
      const task = (e as CustomEvent<TaskKind | null>).detail;
      if (!task) return;
      setPreset({ task, n: Date.now() });
      setShowAgent(true);
    };
    window.addEventListener("mb:agent-open", onOpenTask);
    return () => window.removeEventListener("mb:agent-open", onOpenTask);
  }, []);

  if (!docs) return <div className="p-8 text-sm text-stone-400">Loading…</div>;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar docs={docs} currentId={currentId} onDocsChanged={refresh} />
      <div className="flex-1 overflow-y-auto">{children}</div>
      {showAgent && <AgentPanel onDocsChanged={refresh} seed={seed} preset={preset} wide={!currentId} />}
      <button
        type="button"
        aria-label="切换 Agent 面板"
        onClick={() => setShowAgent((v) => !v)}
        className="absolute bottom-4 right-4 z-20 rounded-full bg-purple-500 px-3 py-2 text-sm text-white shadow-lg hover:bg-purple-600"
      >
        {showAgent ? "✕ Agent" : "✦ Agent"}
      </button>
    </div>
  );
}
