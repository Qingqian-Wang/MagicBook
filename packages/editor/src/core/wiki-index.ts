import MiniSearch, { type SearchResult } from "minisearch";
import { extractLinks, type WikiDoc } from "./doc-store";

// §11 检索：MiniSearch 内存 BM25，中文 bigram 切字，标题权重更高。
// 索引与 DocStore 同生命周期：保存即重换单篇（demo 规模全量重建也毫秒级，简单优先）。
// 同一套 search 同时服务左栏搜索框与 §13 agent 的 search 工具。

export interface SearchHit {
  docId: string;
  title: string;
  excerpt: string;
  score: number;
}

const tokenize = (text: string): string[] => {
  const tokens: string[] = [];
  // 拉丁词直接切；CJK 逐字 bigram
  for (const seg of text.split(/[^\p{L}\p{N}]+/u)) {
    if (!seg) continue;
    if (/[\u4e00-\u9fff]/.test(seg)) {
      for (let i = 0; i < seg.length; i++) {
        tokens.push(seg[i]);
        if (i + 1 < seg.length) tokens.push(seg.slice(i, i + 2));
      }
    } else {
      tokens.push(seg.toLowerCase());
    }
  }
  return tokens;
};

interface IndexRow {
  id: string;
  title: string;
  text: string;
}

export class WikiIndex {
  private mini = new MiniSearch<IndexRow>({
    fields: ["title", "text"],
    storeFields: ["title", "text"],
    searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.2 },
    tokenize,
    processTerm: (term: string) => (term.length > 20 ? term.slice(0, 20) : term),
  });

  rebuild(docs: WikiDoc[]): void {
    this.mini.removeAll();
    this.mini.addAll(docs.map((d) => ({ id: d.id, title: d.title, text: d.text })));
  }

  /** 保存后同步单篇；discard 对不存在的 id 抛错，吞掉即可 */
  update(doc: WikiDoc): void {
    this.mini.discard(doc.id);
    this.mini.add({ id: doc.id, title: doc.title, text: doc.text });
  }

  remove(id: string): void {
    this.mini.discard(id);
  }

  search(query: string, topK = 8): SearchHit[] {
    if (!query.trim()) return [];
    const results = this.mini.search(query, { fuzzy: 0.2, prefix: true }) as (SearchResult & IndexRow)[];
    const q = query.trim();
    return results.slice(0, topK).map((r) => {
      const text = r.text ?? "";
      let excerpt = "";
      const at = text.toLowerCase().indexOf(q.toLowerCase());
      excerpt = at >= 0 ? text.slice(Math.max(0, at - 24), at + 80) : text.slice(0, 100);
      return { docId: r.id, title: r.title ?? "", excerpt, score: r.score };
    });
  }
}

export const wikiIndex = new WikiIndex();

/** Backlinks：谁的正文 [[链接]] 指向 title。运行时反扫，demo 规模不需要缓存 */
export function backlinks(docs: WikiDoc[], title: string): WikiDoc[] {
  return docs.filter((d) => d.links.some((l) => l === title));
}

export { extractLinks };
