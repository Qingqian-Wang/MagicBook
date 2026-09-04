"use client";

// 首页（§10 `/`）的欢迎页：没有打开文档时展示产品与 AI 能力介绍。
// 只做展示 + 复用 docStore 提供「新建 / 导入 / 打开」动作，不承载编辑逻辑。
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Plus, ShieldCheck, Sparkles, Undo2, Wand2 } from "lucide-react";
import { docStore, type WikiDoc } from "@magicbook/editor";

const editorChips = ["斜杠 / 命令", "Markdown", "LaTeX 公式", "代码高亮", "待办清单", "[[ 双向链接 ]]", "图片 / 拖放"];
const guardian = [
  { icon: <ShieldCheck className="h-4 w-4" />, title: "写操作不直接执行", desc: "Agent 想建/改/删文档，一律先生成「提议卡片」摆到你面前。" },
  { icon: <CheckOK />, title: "你点「批准」才落库", desc: "可逐条批准或拒绝；全拒 = 知识库零变化，拒绝原因还会回给模型继续想。" },
  { icon: <Undo2 className="h-4 w-4" />, title: "随时可回滚", desc: "批准前的版本快照存在 prev，改坏了能一键撤回。" },
];

const tasks: {
  kind: "ask" | "tidy" | "ingest";
  emoji: string;
  tag: string;
  title: string;
  desc: string;
  flow: string[];
  hint: string;
}[] = [
  {
    kind: "ask",
    emoji: "💬",
    tag: "Ask · 跨文档问答",
    title: "问你一整座 Wiki",
    desc: "不再逐个翻文档。把问题丢给 Agent，它自己会去全库搜索、翻原文、再回答。",
    flow: ["🔎 search", "📖 readDoc", "💬 回答"],
    hint: "答案会自动带上 [[来源]] 引用；库里没有就直说没有，不编造。",
  },
  {
    kind: "tidy",
    emoji: "🧹",
    tag: "Tidy · 整理",
    title: "让知识库自己变整洁",
    desc: "重命名、补链接、合并近似页、拆分过长的“大杂烩”，甚至全库巡检一键收拢。",
    flow: ["📚 listDocs", "📖 readDoc", "✍️ 提议 updateDoc"],
    hint: "单篇可整理，留空则整库巡检：合并、拆分、给孤立页补入链。",
  },
  {
    kind: "ingest",
    emoji: "📥",
    tag: "Ingest · 长文蒸馏",
    title: "粘贴一坨，吐出一座图谱",
    desc: "把几千字的长文丢进来，Agent 会拆成一页一概念的原子笔记，并互相关联。",
    flow: ["🧩 拆解", "📄 createDoc ×N", "🔗 [[链接]] 关联"],
    hint: "一页只讲一个概念，产出一批提议供你逐条审阅。",
  },
];

function CheckOK() {
  return <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">✓</span>;
}

export function Welcome({
  docs,
  onDocsChanged,
  seeding = false,
}: {
  docs: WikiDoc[];
  onDocsChanged: () => void;
  /** 首次打开正在预置演示知识库 */
  seeding?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const create = async () => {
    const d = await docStore.create("未命名");
    onDocsChanged();
    router.push(`/d/${d.id}`);
  };

  const importFile = async (file: File) => {
    try {
      await docStore.importAll(JSON.parse(await file.text()));
      onDocsChanged();
    } catch (e) {
      alert(`导入失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /** 点击任务卡 → 召唤右侧 Agent 面板并预选对应任务 */
  const summon = (kind: "ask" | "tidy" | "ingest") => {
    window.dispatchEvent(new CustomEvent("mb:agent-open", { detail: kind }));
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      {/* ── Hero ─────────────────────────────── */}
      <header className="text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-600 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
          <Sparkles className="h-3.5 w-3.5" />
          本地优先 · 数据只存在你的浏览器
        </p>
        <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          <span className="bg-gradient-to-r from-purple-500 via-fuchsia-500 to-amber-400 bg-clip-text text-transparent">
            把你的想法，
          </span>
          <br />
          写成一册会自己生长的 Wiki
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-stone-500 dark:text-stone-400">
          MagicBook 是交互式 AI 编辑器：Notion 式书写 × 多文档工作区 × 一个能读你整个知识库的
          Wiki Agent。你可以只管写，整理和问答交给它。
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => void create()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-600"
          >
            <Plus className="h-4 w-4" /> 新建一篇
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            导入备份
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {editorChips.map((c) => (
            <span
              key={c}
              className="rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-500 dark:border-stone-700 dark:bg-stone-800/60 dark:text-stone-400"
            >
              {c}
            </span>
          ))}
        </div>
      </header>

      {/* ── AI 中心区 ────────────────────────── */}
      <section className="mt-14">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-600 dark:bg-purple-900/40 dark:text-purple-300">
            ✦ 你的第二位作者
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-purple-200 to-transparent" />
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight">Wiki Agent：替你读、替你找、替你起草</h2>
        <p className="mt-1 text-stone-500 dark:text-stone-400">
          Agent 在浏览器里跑一个循环，自己决定要不要调工具，每一步你都能看见。三个任务入口：
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {tasks.map((t) => (
            <article
              key={t.tag}
              role="button"
              tabIndex={0}
              onClick={() => summon(t.kind)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  summon(t.kind);
                }
              }}
              aria-label={`在右侧召唤 Agent，运行 ${t.tag}`}
              className="group flex cursor-pointer flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-md focus-visible:border-purple-400 focus-visible:ring-2 focus-visible:ring-purple-200 dark:border-stone-700 dark:bg-stone-900 dark:hover:border-purple-600"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-purple-50 text-2xl dark:bg-purple-900/30">
                  {t.emoji}
                </div>
                <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                  {t.tag}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold leading-snug">{t.title}</h3>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t.desc}</p>

              <div className="mt-4 flex flex-wrap items-center gap-1 rounded-lg bg-stone-50 p-2 text-[11px] text-stone-500 dark:bg-stone-800/60 dark:text-stone-400">
                {t.flow.map((step, i) => (
                  <span key={step} className="inline-flex items-center gap-1">
                    {i > 0 && <ArrowRight className="h-3 w-3 text-stone-300 dark:text-stone-600" />}
                    <span className="rounded bg-white px-1.5 py-0.5 shadow-sm dark:bg-stone-800">{step}</span>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-stone-400 dark:text-stone-500">{t.hint}</p>

              <span className="mt-3 inline-flex items-center gap-1 border-t border-stone-100 pt-3 text-xs font-medium text-purple-500 opacity-0 transition-opacity group-hover:opacity-100 dark:border-stone-800 dark:text-purple-300">
                <Wand2 className="h-3.5 w-3.5" /> 在右侧召唤 Agent
              </span>
            </article>
          ))}
        </div>

        {/* 提议制 / 安全网 */}
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-700/60 dark:bg-amber-900/15">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <Wand2 className="h-4 w-4" /> 一切写入，都由你把关
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {guardian.map((g) => (
              <div key={g.title} className="flex gap-2.5">
                <span className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300">{g.icon}</span>
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{g.title}</p>
                  <p className="text-xs leading-relaxed text-amber-700/80 dark:text-amber-300/70">{g.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 底部：最近 / 引导 ────────────────── */}
      <section className="mt-12">
        {docs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 p-6 text-center dark:border-stone-700">
            {seeding ? (
              <p className="flex items-center justify-center gap-2 text-sm text-stone-500 dark:text-stone-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-purple-500" />
                正在预置演示知识库（三国演义 + React 文档）…
              </p>
            ) : (
              <>
                <p className="text-sm text-stone-500 dark:text-stone-400">还没有文档，这是你的第一页空白。</p>
                <p className="mt-3 text-sm">
                  点左上角 <b>＋</b>，或右下角的 <b>✦ Agent</b>，用一段话描述你想收录的内容 —— 让它开始工作吧。
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-400">
              <FileText className="h-4 w-4" /> 最近编辑
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {docs.slice(0, 8).map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/d/${d.id}`)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-left text-sm shadow-sm transition hover:border-purple-300 hover:bg-purple-50/40 dark:border-stone-700 dark:bg-stone-900 dark:hover:border-purple-700 dark:hover:bg-purple-900/20"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{d.title}</span>
                    </span>
                    <span className="shrink-0 text-xs text-stone-400">
                      {new Date(d.updatedAt).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {docs.length > 8 && (
              <p className="mt-3 text-xs text-stone-400">…还有 {docs.length - 8} 篇，可从左侧列表打开。</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
