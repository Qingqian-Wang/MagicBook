import { describe, expect, it } from "vitest";
import { WikiIndex, backlinks } from "../src/core/wiki-index";

const mk = (id: string, title: string, text: string, links: string[] = []) =>
  ({ id, title, body: { type: "doc" }, text, links, folders: [], updatedAt: 0 }) as any;

describe("WikiIndex", () => {
  const idx = new WikiIndex();
  idx.rebuild([
    mk("1", "RAG 入门", "检索增强生成是 RAG 的核心，混合检索与重排"),
    mk("2", "BM25", "BM25 是稀疏检索算法，与稠密向量互补"),
    mk("3", "Agent 设计", "工具调用循环是 agent 的核心"),
  ]);

  it("中文 bigram 命中", () => {
    expect(idx.search("检索").map((h) => h.docId)).toContain("1");
    expect(idx.search("检索").map((h) => h.docId)).toContain("2");
  });
  it("标题 boost 生效", () => {
    const hits = idx.search("BM25");
    expect(hits[0].docId).toBe("2");
    expect(hits[0].excerpt).toContain("稀疏检索");
  });
  it("拉丁词命中", () => {
    expect(idx.search("agent")[0].docId).toBe("3");
  });
  it("空 query 返回空", () => {
    expect(idx.search("  ")).toEqual([]);
  });
  it("update 后新内容可搜到", () => {
    idx.update(mk("3", "Agent 设计", "新增了 steering 队列的内容"));
    expect(idx.search("steering")[0].docId).toBe("3");
  });
  it("remove 后不再召回", () => {
    idx.remove("1");
    expect(idx.search("检索增强").map((h) => h.docId)).not.toContain("1");
  });
  it("backlinks 反扫", () => {
    const docs = [mk("1", "A", "", ["B"]), mk("2", "B", "", ["B"])];
    expect(backlinks(docs, "B").map((d) => d.id)).toEqual(["1", "2"]);
  });
});
