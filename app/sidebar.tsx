"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search, Trash2 } from "lucide-react";
import { docStore, wikiIndex, type WikiDoc, type SearchHit } from "@magicbook/editor";

// §10 左栏：文档列表 + 搜索（§11 wikiIndex）+ 新建/删除 + 整库导入导出。
// 只依赖 core 层 API，不碰编辑器内部。

export function Sidebar({
  docs,
  currentId,
  onDocsChanged,
}: {
  docs: WikiDoc[];
  currentId?: string;
  onDocsChanged: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    wikiIndex.rebuild(docs);
  }, [docs]);

  const shown = useMemo(() => {
    if (hits) return hits.map((h) => docs.find((d) => d.id === h.docId)).filter(Boolean) as WikiDoc[];
    return docs;
  }, [hits, docs]);

  const onSearch = (q: string) => {
    setQuery(q);
    // 搜索结果实时变化；清空则回到普通列表
    setHits(q.trim() ? wikiIndex.search(q) : null);
  };

  const createDoc = async () => {
    const doc = await docStore.create("Untitled");
    onDocsChanged();
    router.push(`/d/${doc.id}`);
  };

  const removeDoc = async (id: string) => {
    if (!confirm("删除这篇文档？")) return;
    await docStore.remove(id);
    wikiIndex.remove(id);
    onDocsChanged();
    if (currentId === id) router.push("/");
  };

  const exportAll = async () => {
    const payload = JSON.stringify(await docStore.exportAll(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `magicbook-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File) => {
    try {
      await docStore.importAll(JSON.parse(await file.text()));
      onDocsChanged();
    } catch (e) {
      alert(`导入失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-900">
      <div className="flex items-center gap-1 px-3 pb-2 pt-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="搜索文档…"
            className="w-full rounded-md border border-stone-200 bg-white py-1 pl-7 pr-2 text-sm outline-none focus:border-stone-400 dark:border-stone-700 dark:bg-stone-800"
          />
        </div>
        <button
          type="button"
          aria-label="新建文档"
          onClick={createDoc}
          className="rounded-md p-1 text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {shown.length === 0 && (
          <p className="px-2 py-4 text-sm text-stone-400">
            {hits ? "没有匹配的文档" : "还没有文档，点 + 新建"}
          </p>
        )}
        {shown.map((doc) => (
          <div
            key={doc.id}
            className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${
              doc.id === currentId
                ? "bg-stone-200 dark:bg-stone-700"
                : "hover:bg-stone-100 dark:hover:bg-stone-800"
            }`}
          >
            <button
              type="button"
              onClick={() => router.push(`/d/${doc.id}`)}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-stone-400" />
              <span className="truncate">{doc.title}</span>
            </button>
            <button
              type="button"
              aria-label="删除"
              onClick={() => removeDoc(doc.id)}
              className="hidden shrink-0 text-stone-400 hover:text-red-500 group-hover:block"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </nav>

      <div className="flex gap-2 border-t border-stone-200 px-3 py-2 text-xs text-stone-500 dark:border-stone-700">
        <button type="button" className="hover:text-stone-800 dark:hover:text-stone-200" onClick={exportAll}>
          导出
        </button>
        <button type="button" className="hover:text-stone-800 dark:hover:text-stone-200" onClick={() => fileRef.current?.click()}>
          导入
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </aside>
  );
}
