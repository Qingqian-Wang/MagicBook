// §13 Wiki Agent 工具集：读工具直接执行（replay: safe），
// 写工具产出提议（details 带 diff），批准流程在 UI 层（§14）通过 beforeToolCall 实现。
import { docStore, extractText, wikiIndex, backlinks, type WikiDoc } from "../core";
import type { AgentTool, AgentToolResult } from "./agent-loop";

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);

/** markdown → 简易 ProseMirror doc：demo 直接按段落拆，够 agent 写入用 */
function markdownToBody(md: string): WikiDoc["body"] {
  const paras = md
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    type: "doc",
    content: paras.map((p) => {
      const h = p.match(/^(#{1,3})\s+(.*)$/);
      if (h) return { type: "heading", attrs: { level: h[1].length }, content: [{ type: "text", text: h[2] }] };
      if (/^(-|\*)\s+/.test(p)) {
        return {
          type: "bulletList",
          content: p
            .split("\n")
            .map((li) => li.replace(/^(-|\*)\s+/, "").trim())
            .filter(Boolean)
            .map((li) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: li }] }] })),
        };
      }
      return { type: "paragraph", content: [{ type: "text", text: p }] };
    }),
  };
}

export function makeWikiTools(opts: {
  /** 写操作批准回调：返回 true 放行。UI 弹提议卡片等待用户 */
  approveWrite: (proposal: WriteProposal) => Promise<boolean>;
}): AgentTool[] {
  const { approveWrite } = opts;

  // ---- 读工具 ----

  const search: AgentTool<unknown> = {
    name: "search",
    label: "搜索",
    description: "在知识库全文检索。返回匹配文档的 id、标题、摘要片段。",
    replay: "safe",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "检索关键词" },
        topK: { type: "number", description: "返回条数，默认 8" },
      },
      required: ["query"],
    },
    execute: async (params) => {
      const hits = wikiIndex.search(str(params.query), num(params.topK, 8));
      return {
        content: [
          {
            type: "text",
            text: hits.length
              ? hits.map((h, i) => `[${i + 1}] ${h.title} (id=${h.docId})\n${h.excerpt}`).join("\n---\n")
              : "没有匹配的文档",
          },
        ],
        details: { kind: "search", hits },
      };
    },
  };

  // 联网搜索：本地知识库检索不足时兜底。走 /api/search（服务端代理 + 解析），
  // 读工具（replay: safe），不产生提议；可随 agent 停止中断。
  const webSearch: AgentTool<unknown> = {
    name: "webSearch",
    label: "联网搜索",
    description:
      "在互联网上搜索（当本地知识库 search 找不到足够信息时使用）。返回网页的标题、链接与摘要片段。",
    replay: "safe",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词（尽量具体，可用中文）" },
        maxResults: { type: "number", description: "返回条数，默认 5" },
      },
      required: ["query"],
    },
    execute: async (params, ctx) => {
      const query = str(params.query);
      const maxResults = num(params.maxResults, 5);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&n=${maxResults}`,
          { signal: ctx?.signal, cache: "no-store" },
        );
        if (!res.ok) {
          return {
            content: [{ type: "text", text: `联网搜索失败（${res.status}）` }],
            details: { kind: "webSearchError", query, status: res.status },
          };
        }
        const data = (await res.json()) as { results?: { title: string; url: string; snippet: string }[] };
        const results = data.results ?? [];
        const text = results.length
          ? results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join("\n---\n")
          : "没有搜到相关网页结果";
        return { content: [{ type: "text", text }], details: { kind: "webSearch", query, results } };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `联网搜索失败：${msg}` }],
          details: { kind: "webSearchError", query, error: msg },
        };
      }
    },
  };

  const readDoc: AgentTool<unknown> = {
    name: "readDoc",
    label: "读文档",
    description: "按 id 读取一篇文档的标题与全文纯文本。",
    replay: "safe",
    parameters: {
      type: "object",
      properties: { id: { type: "string", description: "文档 id（来自 search/listDocs）" } },
      required: ["id"],
    },
    execute: async (params) => {
      const doc = await docStore.get(str(params.id));
      if (!doc) return { content: [{ type: "text", text: "文档不存在" }], details: { kind: "error" } };
      return {
        content: [{ type: "text", text: `# ${doc.title}\n\n${doc.text}` }],
        details: { kind: "readDoc", id: doc.id, title: doc.title },
      };
    },
  };

  const listDocs: AgentTool<unknown> = {
    name: "listDocs",
    label: "列出文档",
    description: "列出知识库全部文档（id + 标题 + 更新时间）。",
    replay: "safe",
    parameters: { type: "object", properties: {} },
    execute: async () => {
      const docs = await docStore.list();
      return {
        content: [
          {
            type: "text",
            text: docs.length
              ? docs.map((d) => `- ${d.title} (id=${d.id}, updated=${new Date(d.updatedAt).toISOString()})`).join("\n")
              : "知识库为空",
          },
        ],
        details: { kind: "listDocs", count: docs.length },
      };
    },
  };

  const backlinksTool: AgentTool<unknown> = {
    name: "backlinks",
    label: "查反向链接",
    description: "查哪些文档的正文 [[链接]] 指向给定标题。",
    replay: "safe",
    parameters: {
      type: "object",
      properties: { title: { type: "string", description: "目标文档标题" } },
      required: ["title"],
    },
    execute: async (params) => {
      const docs = await docStore.list();
      const links = backlinks(docs, str(params.title));
      return {
        content: [
          {
            type: "text",
            text: links.length
              ? links.map((d) => `- ${d.title} (id=${d.id})`).join("\n")
              : `没有文档链接到「${str(params.title)}」`,
          },
        ],
        details: { kind: "backlinks", title: str(params.title), docs: links.map((d) => ({ id: d.id, title: d.title })) },
      };
    },
  };

  // ---- 写工具：全部走提议 ----

  const propose = async (proposal: WriteProposal, run: () => Promise<AgentToolResult>): Promise<AgentToolResult> => {
    const approved = await approveWrite(proposal);
    if (!approved) {
      return {
        content: [{ type: "text", text: `用户拒绝了这次${proposal.kind}操作：${proposal.reason ?? ""}`.trim() }],
        details: { kind: "rejected", proposal },
      };
    }
    return run();
  };

  const createDoc: AgentTool<unknown> = {
    name: "createDoc",
    label: "新建文档",
    description: "新建一篇文档（Markdown 正文，支持 # 标题 / 列表 / [[链接]]）。需要用户批准。",
    replay: "never",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "文档标题" },
        markdown: { type: "string", description: "正文 Markdown" },
      },
      required: ["title", "markdown"],
    },
    execute: async (params) => {
      const title = str(params.title, "Untitled");
      const md = str(params.markdown);
      return propose(
        { kind: "create", title, markdown: md, reason: str(params.__reason) },
        async () => {
          const doc = await docStore.create(title, [], markdownToBody(md));
          wikiIndex.update(doc);
          return {
            content: [{ type: "text", text: `已创建《${doc.title}》(id=${doc.id})` }],
            details: { kind: "created", doc: { id: doc.id, title: doc.title } },
          };
        },
      );
    },
  };

  const updateDoc: AgentTool<unknown> = {
    name: "updateDoc",
    label: "更新文档",
    description: "整体替换一篇文档的正文（Markdown）。原内容会存入 prev 支持回滚。需要用户批准。",
    replay: "never",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "目标文档 id" },
        markdown: { type: "string", description: "新的完整正文 Markdown" },
        reason: { type: "string", description: "为什么要改" },
      },
      required: ["id", "markdown"],
    },
    execute: async (params) => {
      const id = str(params.id);
      const doc = await docStore.get(id);
      if (!doc) return { content: [{ type: "text", text: "文档不存在" }], details: { kind: "error" } };
      const md = str(params.markdown);
      return propose(
        { kind: "update", docId: id, title: doc.title, oldMarkdown: doc.text, markdown: md, reason: str(params.reason) },
        async () => {
          const body = markdownToBody(md);
          const updated: WikiDoc = {
            ...doc,
            body,
            text: extractText(body),
            prev: { body: doc.body, text: doc.text },
            updatedAt: Date.now(),
          };
          await docStore.put(updated);
          wikiIndex.update(updated);
          return {
            content: [{ type: "text", text: `已更新《${doc.title}》` }],
            details: { kind: "updated", doc: { id: updated.id, title: updated.title } },
          };
        },
      );
    },
  };

  const deleteDoc: AgentTool<unknown> = {
    name: "deleteDoc",
    label: "删除文档",
    description: "删除一篇文档。需要用户批准。",
    replay: "never",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "目标文档 id" },
        reason: { type: "string", description: "为什么要删" },
      },
      required: ["id"],
    },
    execute: async (params) => {
      const id = str(params.id);
      const doc = await docStore.get(id);
      if (!doc) return { content: [{ type: "text", text: "文档不存在" }], details: { kind: "error" } };
      return propose(
        { kind: "delete", docId: id, title: doc.title, reason: str(params.reason) },
        async () => {
          await docStore.remove(id);
          wikiIndex.remove(id);
          return {
            content: [{ type: "text", text: `已删除《${doc.title}》` }],
            details: { kind: "deleted", doc: { id, title: doc.title } },
          };
        },
      );
    },
  };

  return [search, webSearch, readDoc, listDocs, backlinksTool, createDoc, updateDoc, deleteDoc];
}

/** 提议：写工具被 beforeToolCall/approveWrite 拦下时给 UI 渲染的全部信息 */
export interface WriteProposal {
  kind: "create" | "update" | "delete";
  docId?: string;
  title: string;
  markdown?: string;
  oldMarkdown?: string;
  reason?: string;
}
