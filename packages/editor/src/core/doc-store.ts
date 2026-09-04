import type { JSONContent } from "@tiptap/core";

// §10 多文档存储：真源在浏览器 IndexedDB。
// 字段与 features.md §10 对齐：id/title/body/text/folders/links/updatedAt/prev
export interface WikiDoc {
  id: string;
  title: string;
  /** ProseMirror JSON，编辑真源 */
  body: JSONContent;
  /** 保存时从 body 抽出的纯文本，检索用（§11） */
  text: string;
  /** 字符串数组而非真实层级，demo 够用 */
  folders: string[];
  /** 正文里的 [[标题]]，保存时解析写入（§11） */
  links: string[];
  updatedAt: number;
  /** 上一版 body/text，供一键回滚（§13 写工具批准后写入） */
  prev?: { body: JSONContent; text: string };
}

const DB_NAME = "magicbook";
const DB_VERSION = 1;
const STORE = "docs";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export function newDocId(): string {
  return crypto.randomUUID();
}

const EMPTY_BODY: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

/** 从 ProseMirror JSON 抽纯文本：检索只需要文字，不要结构 */
export function extractText(body: JSONContent): string {
  const out: string[] = [];
  const walk = (node: JSONContent | undefined) => {
    if (!node) return;
    if (node.text) out.push(node.text);
    node.content?.forEach(walk);
  };
  walk(body);
  return out.join(" ").replace(/\s+/g, " ").trim();
}

/** 解析正文里的 [[标题]] 链接（§11）；text 上找，避免重复遍历 */
export function extractLinks(body: JSONContent): string[] {
  const text = extractText(body);
  const links = new Set<string>();
  for (const m of text.matchAll(/\[\[([^\[\]]+?)\]\]/g)) links.add(m[1].trim());
  return [...links];
}

export class DocStore {
  async list(): Promise<WikiDoc[]> {
    const docs = await tx<WikiDoc[]>("readonly", (s) => s.getAll() as IDBRequest<WikiDoc[]>);
    return docs.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<WikiDoc | undefined> {
    return tx<WikiDoc | undefined>("readonly", (s) => s.get(id) as IDBRequest<WikiDoc | undefined>);
  }

  /** 全量写；prev 在外部显式传入（§13 批准流程负责），这里不做隐式快照 */
  async put(doc: WikiDoc): Promise<void> {
    await tx("readwrite", (s) => s.put(doc));
  }

  async create(title: string, folders: string[] = [], body: JSONContent = EMPTY_BODY): Promise<WikiDoc> {
    const now = Date.now();
    const doc: WikiDoc = {
      id: newDocId(),
      title: title.trim() || "Untitled",
      body,
      text: extractText(body),
      folders,
      links: extractLinks(body),
      updatedAt: now,
    };
    await this.put(doc);
    return doc;
  }

  async remove(id: string): Promise<void> {
    await tx("readwrite", (s) => s.delete(id));
  }

  /** 一键回滚到 prev（§13） */
  async rollback(id: string): Promise<WikiDoc | undefined> {
    const doc = await this.get(id);
    if (!doc?.prev) return doc;
    const restored: WikiDoc = {
      ...doc,
      body: doc.prev.body,
      text: doc.prev.text,
      links: extractLinks(doc.prev.body),
      prev: undefined,
      updatedAt: Date.now(),
    };
    await this.put(restored);
    return restored;
  }

  /** 整库导出/导入：demo 唯一的数据迁移通道（§10 验收项） */
  async exportAll(): Promise<{ version: 1; exportedAt: number; docs: WikiDoc[] }> {
    return { version: 1, exportedAt: Date.now(), docs: await this.list() };
  }

  async importAll(
    payload: unknown,
    mode: "merge" | "replace" = "merge",
  ): Promise<{ imported: number }> {
    const data = payload as { docs?: WikiDoc[] };
    if (!Array.isArray(data?.docs)) throw new Error("Invalid backup file");
    if (mode === "replace") {
      const existing = await this.list();
      for (const d of existing) await this.remove(d.id);
    }
    for (const d of data.docs) {
      if (!d?.id || typeof d.title !== "string" || !d.body) continue;
      await this.put({ ...d, updatedAt: d.updatedAt ?? Date.now() });
    }
    return { imported: data.docs.length };
  }
}

export const docStore = new DocStore();
