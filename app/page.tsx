"use client";

// §10 首页：欢迎页（产品 + AI 能力介绍 + 最近文档 / 新建引导）。编辑本体在 /d/[id]。
// 首次打开且本地为空时自动预置演示知识库（public/seeds），让访客直接看到内容。
import { Shell } from "./shell";
import { Welcome } from "./welcome";
import { ensureDemoSeeds } from "./demo-seed";
import { docStore, type WikiDoc } from "@magicbook/editor";
import { useCallback, useEffect, useState } from "react";

export default function Home() {
  const [docs, setDocs] = useState<WikiDoc[] | null>(null);
  const [seeding, setSeeding] = useState(false);

  const refresh = useCallback(async () => setDocs(await docStore.list()), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const initial = await docStore.list();
      if (!cancelled && initial.length === 0) {
        setSeeding(true);
        try {
          await ensureDemoSeeds();
        } finally {
          if (!cancelled) setSeeding(false);
        }
      }
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  if (!docs) return null;

  return (
    <Shell>
      <Welcome docs={docs} onDocsChanged={refresh} seeding={seeding} />
    </Shell>
  );
}


