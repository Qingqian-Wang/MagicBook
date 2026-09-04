# MagicBook 项目结构与设计

> 交互式 AI 编辑器 → LLM Wiki demo。Notion 风格富文本 + 多文档工作区 + 自主 Wiki Agent。
> 状态：§0–14 已完成（见 `features.md`），§15（Vercel 部署）无代码改动待做。

## 总览

```
MagicBook/
├── app/                      Next.js 应用壳（组装层，无业务逻辑）
├── packages/editor/          @magicbook/editor 编辑器独立包
│   └── src/
│       ├── core/             数据层：存储 + 检索（无 UI 依赖）
│       ├── editor/           编辑器内核：Tiptap 扩展注册表与装配
│       ├── ui/               交互组件：斜杠菜单、气泡菜单选择器
│       └── agent/            Wiki Agent：loop 内核 + 工具 + 任务模板（唯一 AI 体系）
└── features.md               开发路线图（Part A §0–9 / Part B §10–15，含勾选状态）
```

## 分层与依赖方向

```
app ──→ agent ──→ ui ──→ editor ──→ core
（单向，禁止反向 import；app 只组装不写逻辑）
```

| 层 | 职责 | 关键文件 |
|---|---|---|
| **app** | 路由、页面壳、服务端 LLM 代理 | `shell.tsx`（三栏布局）、`sidebar.tsx`、`d/[id]/page.tsx`、`agent-panel.tsx`、`api/agent` |
| **agent** | 浏览器端 agent loop、工具集、任务模板 | `agent-loop.ts`、`tools.ts`、`tasks.ts`、`prompts/*.md` |
| **ui** | 气泡菜单各 selector、斜杠菜单、图片缩放 | `selectors/`、`slash-command/`、`media/` |
| **editor** | EditorRoot/EditorContent 装配 + 每扩展一个文件 | `editor.tsx`、`extensions/`（20 个）、`suggestion/`（portal 机制） |
| **core** | DocStore、BM25 索引、序列化 | `doc-store.ts`、`wiki-index.ts`、`serialize.ts`、`storage.ts` |

## AI 体系（统一为 Wiki Agent）

原行内 AI（§7）已于 2026-09 移除，
全部 AI 能力收敛到 Wiki Agent 一条链路：

- **唯一后端**：`/api/agent`（OpenAI 兼容代理，非流式）；`ai`/`@ai-sdk/openai` 依赖已删
- **入口两个，同一个 agent**：
  - 右栏 Agent 面板（三个任务 tab：Ask / Tidy / Ingest）
  - 编辑器气泡菜单 ✨ Ask AI 按钮——不再是独立面板，只把选中文本经 `mb:ask-ai` 事件
    发给右栏（Shell 监听 → 打开面板 → 预填 Ask 任务），改写由 agent 的 `updateDoc` 提议承担
- **写入统一提议制**：一切落库都走提议卡片 → 人工批准（无直接改编辑器内容的旁路）

## 核心设计决策

### 1. 数据真源在浏览器（§10）
IndexedDB `DocStore`，文档记录 `{id, title, body(ProseMirror JSON), text, folders, links, updatedAt, prev}`。
- `body` 是编辑真源；`text` 保存时抽取（检索用）；`links` 解析 `[[标题]]` 得到
- `prev` 字段：agent 写入前快照，支持一键回滚（`docStore.rollback`）
- 整库导出/导入 JSON 是唯一迁移通道
- **无服务端存储**：Vercel 上只有两个 LLM 代理路由；换设备 = 导出再导入

### 2. 检索不上向量库（§11）
MiniSearch 内存 BM25；中文 bigram 切字、标题 ×3 boost、fuzzy 0.2。
demo 规模（千级文档）毫秒建索引，embedding provider、pgvector 全部不需要。
`wikiIndex.update/remove` 与保存同步增量。

### 3. Agent loop 在浏览器（§12）
`/api/agent` 只做 key 注入与协议转发；循环、工具执行、批准等待都在客户端——
工具直接读写 IndexedDB，没有后端往返。
运行时由六项自研契约组成（双层载荷 / 轨迹流 / 写闸门 / 重放标记 / 旁路输入 / 任务卡），刻意不引入服务端重运行时那套（状态机、双阶段提交、分支/fork、操作日志等）：

| 契约 | 落点 |
|---|---|
| **双层载荷** `{content, details}` | `content` 进模型上下文，`details` 只给 UI 渲染（diff/命中列表） |
| **轨迹流** `AgentEvent` | `turn_*` / `tool_start/update/end` / `assistant_message` / `agent_end`；UI 只订阅事件 |
| **写闸门** `beforeToolCall` | 钩子拦下写工具 → 弹提议卡片 → 批准放行；拒绝时 reason 作为 error tool result 回给模型继续推理 |
| **重放标记** `replay: safe/never` | 读工具可重跑；写工具停止即丢弃不补跑 |
| **旁路输入** steering / follow-up | 运行中输入不锁，追加指令下轮注入 |
| **任务卡** prompt 模板 | 任务 = md 文件（`prompts/*.md`），改行为不改代码 |

明确非目标（浏览器就近运行场景刻意不做）：崩溃恢复、持久运行时、多租户、断流重连。

### 4. 写保护 = 提议制（§13）
八个工具：读 `search / webSearch / readDoc / listDocs / backlinks`（直接执行，webSearch 走 `/api/search` 联网兜底），
写 `createDoc / updateDoc / deleteDoc`（全部走 `approveWrite` → 提议卡片）。
全拒 = 库零变化；`updateDoc` 批准后写 `prev` 可回滚。

### 5. 三栏壳（§14）
左（文档列表+搜索+导入导出）｜中（编辑器）｜右（Agent 面板，按需开关）。
Agent 面板把事件流映射成可视步骤：工具行（名字+参数+状态）、
琥珀色提议卡片（新旧对照+批准/拒绝）、steering 输入、停止按钮（AbortSignal）。

## 请求链路

```
编辑器保存   EditorContent.onUpdate ─debounce 500ms→ docStore.put + wikiIndex.update
Wiki Agent  agent-panel ─runAgent→ fetch /api/agent（循环）
气泡菜单 ✨ 选中 → mb:ask-ai 事件 → Shell 打开右栏并预填 Ask 任务（同一 agent）
              ├─ 模型决定调工具 → 读工具直接执行（IndexedDB）
              └─ 写工具 → approveWrite → 提议卡片 → 用户批准 → 执行 + 存 prev
```

## 环境与运行

```
.env.local: OPENAI_API_KEY / OPENAI_MODEL（deepseek-v4-flash）/ OPENAI_BASE_URL（deepseek）
npm run dev          # 默认 3000；本机 3000 被占，用 -- -p 3210
npm run typecheck    # tsc --noEmit
npx vitest run       # 11 个测试：wiki-index 7 + agent-loop 4
npm run build:editor # tsup 打包 @magicbook/editor（.md 模板以 text loader 打入）
```

注意：`next.config.mjs` 里 webpack 对 `*.md` 用 `asset/source`（任务模板）；
根 `tsconfig.json` include 了 `packages/editor/src/**/*.d.ts`（md 模块类型声明），exclude 只剩 `node_modules`。

## 已知边界 / 待办

- assistant 回复是 turn 粒度，非逐字流（工具事件是过程可视主体）
- `[[标题]]` 在编辑器中是纯文本，点击跳转未做
- folders 字段存在但 UI 未暴露（Ingest 模板里写入 "ingest" folder）
- 搜索 excerpt 定位算法简陋（首个词命中）
- assistant 回复为 turn 粒度的代价：Ask 任务对单个选区的改写要走整篇 updateDoc 提议
- §15 部署：连 Vercel 即可，配置 `OPENAI_*` 环境变量
