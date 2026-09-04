# 功能拆解（按开发依赖顺序）

> 排序原则：底层先行，后续功能依赖前面已完成的层。可作为 MagicBook 的开发路线图。

## [x] 0. 技术选型与项目骨架
- Next.js（App Router）+ React + TypeScript + Tailwind
- 编辑器内核基于 Tiptap（ProseMirror），AI 调用统一走 OpenAI 兼容代理（`/api/agent`）
- 产出：能渲染空页面的应用骨架

## [x] 1. 编辑器内核（一切的基础）
- `EditorRoot` / `EditorContent` 组件：挂载 Tiptap 编辑器实例
- **块级结构**：段落、标题 H1–H3、无序/有序列表、待办列表（可嵌套）、引用块、代码块（lowlight 语法高亮）、水平分割线
- **行内格式**：粗体、斜体、下划线、删除线、行内代码、文字颜色、背景高亮、链接
- StarterKit 基础能力：撤销/重做、光标处理、输入规则
- **Placeholder**：空块占位提示
- 产出：能打字、排版的基础编辑器

## [x] 2. 数据层：序列化与持久化
- 文档模型为 ProseMirror JSON
- Markdown 扩展：输入 Markdown 语法即时转换；可导出 Markdown / HTML
- 自动保存：onUpdate 防抖 500ms 写入 localStorage（JSON 为主），带 Save Status 状态显示
- 产出：刷新页面内容不丢的编辑器

## [x] 3. 斜杠命令菜单（/）
- 依赖：§1 的块类型已就绪
- 输入 `/` 唤起命令面板，关键词模糊搜索（searchTerms），键盘导航（↑↓ / Enter）
- 命令项即 §1 各块类型的插入入口：Text、To-do List、H1–H3、两种列表、Quote、Code、分隔线（Image / Youtube / Twitter 三项已移除）
- 产出：Notion 式块插入体验

## [x] 4. 气泡菜单（选中文本触发）
- 依赖：§1 的格式能力；提供后续 AI 功能的挂载点
- **BlockTypeSelector**：切换块类型
- **FormatButtons**：粗体/斜体/下划线/删除线/代码切换
- **TextColorSelector**：文字颜色 + 高亮色
- **LinkEditor**：添加/编辑/移除链接
- 产出：选中文本即可格式化

## [x] 5. 媒体能力
- 依赖：§3 斜杠菜单作为插入入口之一
- **图片**：粘贴 / 拖拽两种插入（原斜杠命令入口已移除）；上传中半透明占位图，完成后替换；上传函数 `uploadFn` 可插拔（demo 用 Vercel Blob）；**ImageResizeHandle** 拖拽调整尺寸
- **嵌入**：YouTube、Twitter 扩展仍在，但已无斜杠入口（§13 采集流程会以「链接转卡片」形式重新给出口）
- **数学公式**：KaTeX 行内/块级公式，气泡菜单 MathSelector 转换选中内容
- 产出：富媒体文档

## [x] 6. 行内 AI 后端（已移除）
> 2026-09 统一 AI 体系时移除：独立的行内 AI 服务端路由与其 SDK 依赖已删，全部 LLM 调用走 §12 的 `/api/agent`（OpenAI 兼容代理）。
- 依赖：无前端依赖，可与 §3–5 并行开发
- 原形态：按选项匹配系统提示词，流式返回 Markdown
- 预设选项：续写 / 润色 / 缩写 / 扩写 / 修语法 / 自由指令
- 产出：可调通的 AI 文本接口

## [x] 7. 行内 AI 前端交互（已移除）
> 2026-09 统一 AI 体系时移除：气泡菜单内的行内 AI 面板、高亮扩展与 `packages/editor/src/ai/` 整层删除。
> 保留的能力：气泡菜单「Ask AI」按钮仍存在，但只做一件事——把选中文本通过 `mb:ask-ai` 事件发给右栏 Wiki Agent（§14），预填 Ask 任务。行内改写由 agent 的 updateDoc 提议承担。
- 依赖：§4 气泡菜单（挂载 Ask AI 入口）、§6 后端接口
- **Ask AI 按钮**：选中文本后气泡菜单中出现
- **处理高亮**：处理期间选中段落高亮，结束/取消后移除
- **AI 面板**：预设指令菜单（润色 / 修语法 / 缩写 / 扩写 / 续写）+ 自由指令输入，可对上一次结果追问迭代；流式输出实时渲染
- **结果操作**：替换选区 / 插入下方 / 丢弃
- 产出：完整的选中→AI 处理→回填闭环

## [x] 8. 体验增强（可选，最后做）
- **GlobalDragHandle**：块级拖拽手柄，拖动重排内容
- **CustomKeymap**：自定义快捷键
- **CharacterCount**：字数统计显示
- 深色模式（Tailwind `dark:`）
- 导出 HTML 时用 highlight.js 二次高亮代码块

## [x] 9. 工程化与集成形态
- 编辑器抽为独立包：`packages/editor`（`@magicbook/editor`，含 core/editor/ui/agent 四层），app 经 `transpilePackages` 消费源码
- tsup dist 构建已验证（esm/cjs/dts，`npm run build:editor`）
- 部署配置：`vercel.json` + `.env.example` + README
- 注意：无协同编辑（未接 Yjs）、无文件管理——这两项是 MagicBook 需要自行补建的差异化能力

---

# Part B：LLM Wiki Demo（重点是 Agent）

> 定位：demo project。**零中间件**——不接数据库、不做鉴权、没有队列与自建模型。
> 数据全在浏览器端（IndexedDB），Vercel 只托管 Next.js 应用 + LLM 代理路由。
> 要演示清楚的一条主线：agent 自主「检索 → 多步推理 → 工具写库 → 人工批准」。

## [x] 10. 工作区：多文档存储（浏览器端）
- 依赖：§2 数据层
- **DocStore（IndexedDB）**取代单 key localStorage，仍走 StorageAdapter 风格接口：
  - `list() / get(id) / put(doc) / create(title) / remove(id)`
  - 文档记录：`id / title / body(JSON 编辑真源) / text(保存时从 JSON 抽出的纯文本，检索用) / folders: string[] / links: string[] / updatedAt / prev(上一版，供回滚)`
- **folders 只是字符串数组**，不做真实层级；左栏「按标题排序 / 按 folder 分组」两种视图够用
- **导出 / 导入 JSON**（整库备份下载与恢复）——demo 唯一的数据迁移通道
- 路由：`/` 空态或最近文档；`/d/[id]` 编辑；切文档前 flush 未保存内容
- 验收：多文档可建、可切换、刷新不丢；整库导出后换浏览器能原样导入

## [x] 11. 检索与链接（本地 BM25，不上向量库）
- 依赖：§10 的 text 字段
- **minisearch**（纯 JS、内存索引）：title+text 建 BM25 索引，中文用 bigram 切字；千级文档启动毫秒完成，无需任何 embedding
- **链接 = 正文里的 `[[标题]]`**：保存时解析写入 `links[]`；Backlinks 运行时反扫（带缓存），不建存储
- 搜索结果统一带 `docId + excerpt`，同时服务人（搜索框）和 agent（§12 的 search 工具）
- 验收：改一段话后立刻搜得到新内容；能列出「哪些页面引用了本页」

## [x] 12. Agent 内核（浏览器端运行时：轻量 + 六项契约）
- 依赖：§10 §11。运行环境是「浏览器 + IndexedDB + 短任务 + 可中断」，因此运行时刻意做得轻，不引入服务端重持久化。
- **设计取向（轻量）**：只保留对「浏览器就近读写 + 可观测 + 可撤销」必要的抽象；重服务端运行时那套（操作状态机、双阶段提交、分支/fork、操作日志、副作用闸门）在本场景全是负担，一律不引入。**明确非目标：崩溃恢复、多租户并发、断流重连**
- 六项运行时契约：
  1. **`AgentTool` 形状**：`{ name, label, description, parameters, execute(id, params, signal, onUpdate) }`，返回 `{ content, details }`。
     `content` 发给模型，`details` 只给 UI 渲染（结构化 diff/命中列表）——这条分离是整个 UI 能显示过程的原因
  2. **事件流**：`agent_start / turn_start / turn_end / message_update / tool_execution_start|update|end`。UI 只订阅事件，不猜状态；`onUpdate` 让长工具能吐中间进度
  3. **`beforeToolCall` 钩子 → 批准机制**：返回 `{ block: true, reason }` 即阻止执行、循环自动产出一条 error tool result。写工具不自己造"待批准"状态，而是**被钩子拦下**：钩子把提议交给右栏，用户批准才放行，拒绝就把 reason 回给模型继续推理。读工具天然放行
  4. **`replay: "never" | "safe"`**：读工具 `safe`、写工具 `never`。用户点停止时，正在跑的工具按此决定是重跑还是丢弃，不用特判
  5. **steering 队列**：agent 跑动中用户还能追加话（`getSteeringMessages` 每轮工具结束后注入；`getFollowUpMessages` 在本要停下时注入）。demo 里就是输入框不 disable
  6. **`terminate` 提示**：工具可建议本批结束后收工，省一轮无意义调用
- **循环落地在浏览器**：`/api/agent` 只做 provider 代理（注入 key，转发流），前端持有 messages/tools 并跑 loop——这样工具调用才能直接打到 IndexedDB，否则每次读写都要多一次后端往返
- 轻量上下文控制（代号 **上下文压舱 / Context Ballast**）：估算超预算时按 turn 边界裁旧消息 + 让模型摘要旧轮；只保留「保留 reserveTokens 余量、切点不切开工具对」两条规则
- 验收：手上有 3 篇文档时，能观测到完整事件序列（search→read→propose），中途点拒绝后模型收到 error result 并换路继续

## [x] 13. Wiki Agent 的工具与任务
- 依赖：§12
- **工具集**（操作 §10 DocStore + 联网兜底）：
  - 读（`replay: safe`，立即执行）：`search(query, topK?)` / `webSearch(query, maxResults?)`（联网，走 `/api/search`）/ `readDoc(id)` / `listDocs(folder?)` / `backlinks(title)`
  - 写（`replay: never`，走 §12.3 批准）：`createDoc` / `updateDoc(id, markdown)` / `appendLinks(id, links[])` / `deleteDoc(id)`
  - 每个写工具在 `details` 里带 diff（新旧内容 + 理由 + 引用来源 docId），供提议卡片渲染；批准前不落库，落库前把当前版写进 `prev` 支持一键回滚
- **任务是「任务卡」（提示词模板）不是代码分支**（markdown 文件 + frontmatter 描述，运行时包裹注入）：
  - **Ask**：跨文档问答，答案必须带 `[[来源]]`；库里没有就回答没有，不编造出处
  - **Tidy**：单篇整理（摘要/归类/补 `[[链接]]`）或全库巡检（近似标题提议合并、长文提议拆分、孤儿页提议归类）
  - **Ingest**：粘进来的长文 → 拆成一页一概念原子笔记 → 一批提议
  - 模板存在包里（`src/agent/prompts/*.md`），改行为不改代码
- 验收：同一句「把《A》《B》里关于 X 的整理成一页」，agent 自主 search→read→createDoc；全部拒绝后库零变化；接受后能回滚

## [x] 14. 交互：三栏壳 + Agent 面板
- 依赖：§12 §13（本层只组装，不新增业务逻辑）
- 布局：**左** 文档列表 + 搜索｜**中** 编辑器｜**右** Agent 面板
- 右栏把 §12 的事件流直接映射成可视步骤：每轮 turn 一个块，工具调用一行（名字 + 参数摘要 + 状态），`tool_execution_update` 刷新中间进度；`details` 里的结构化数据渲染成命中列表/diff，而不是把模型的原始输出糊上去
- **提议卡片** = §12.3 钩子的 UI：动作类型 + 目标文档 + diff + 理由 + 「批准 / 拒绝 / 批准全部」；拒绝时可补一句说明，作为 steering 消息回给模型
- 运行中输入框保持可用（追加即入 steering 队列）；停止按钮走 `AbortSignal`，写工具按 `replay: never` 不补跑
- `⌘K`：跳文档 / 新建 / 聚焦 Agent；空态三个动作 = 三个任务模板
- 验收：Ask / Tidy / Ingest 三条主路径 ≤3 步可达，且每一步都能看到 agent 在做什么

## [ ] 15. 部署（Vercel 一键）
- 依赖：§12
- Vercel 上只有静态页面 + 一个 LLM 代理路由（`/api/agent`），API key 留在服务端 env；无 DB、无 Redis、无 cron、无对象存储（图片用 data URL）
- 附带卖点：知识库本体不出浏览器，只有问答需要的片段发给模型；每个访问者各用各的本地数据，天然互不干扰
- 验收：仓库连 Vercel 后打开链接即可完整体验三条主路径

---

### 关键依赖链速览
```
§0 骨架 → §1 编辑器内核 → §2 数据持久化
                    ├────→ §3 斜杠菜单
                    └────→ §4 气泡菜单 ──→ §7 AI 前端 ─┐
§6 AI 后端（可并行）──────────────────────────────────┘
§5 媒体 / §8 体验增强：视优先级插入
§9 工程化：收尾

Part B（LLM Wiki Demo）：
§10 工作区(IndexedDB) → §11 检索+链接 → §12 Agent 内核 → §13 工具与任务 → §14 交互
                                                                    └──→ §15 部署
```
