import type { JSONContent } from "@tiptap/core";

// 所有持久化必须走此接口，禁止散落调用 localStorage
export interface StorageAdapter {
  load(): Promise<JSONContent | null>;
  save(doc: JSONContent): Promise<void>;
}

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly key = "magicbook-content") {}

  async load(): Promise<JSONContent | null> {
    const raw = window.localStorage.getItem(this.key);
    if (!raw) return EMPTY_DOC;
    try {
      return JSON.parse(raw) as JSONContent;
    } catch {
      // 损坏数据不阻断打开，回退到空文档
      return EMPTY_DOC;
    }
  }

  async save(doc: JSONContent): Promise<void> {
    window.localStorage.setItem(this.key, JSON.stringify(doc));
  }
}
