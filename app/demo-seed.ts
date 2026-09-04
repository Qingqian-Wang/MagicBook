"use client";

// 演示预置：首次打开（本地知识库为空）时，把随应用托管的 seed JSON
// 自动导入 IndexedDB，让演示者/访客点开 URL 就能直接看到内容。
//
// seed 文件放 public/seeds/*.json（静态托管、按需拉取，不打进 JS bundle）。
// importAll 默认 merge，两套可依次导入且不会覆盖已有文档。
import { docStore } from "@magicbook/editor";

const SEEDS = ["/seeds/sanguo-import.json", "/seeds/react-docs-import.json"];

export async function ensureDemoSeeds(): Promise<{ seeded: boolean; imported: number }> {
  const existing = await docStore.list();
  if (existing.length > 0) return { seeded: false, imported: 0 };

  let imported = 0;
  let any = false;
  for (const url of SEEDS) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const payload = (await res.json()) as { docs?: unknown[] };
      if (!Array.isArray(payload?.docs) || payload.docs.length === 0) continue;
      const { imported: n } = await docStore.importAll(payload, "merge");
      imported += n;
      any = true;
    } catch {
      // 某个 seed 拉取/解析失败就跳过，不影响其它 seed
    }
  }
  return { seeded: any, imported };
}
