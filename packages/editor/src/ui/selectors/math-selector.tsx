"use client";

import { useCurrentEditor } from "@tiptap/react";
import { SigmaIcon } from "lucide-react";

// 选中普通文本 → 转为 KaTeX 公式节点；选中公式 → 还原为文本
export const MathSelector = () => {
  const { editor } = useCurrentEditor();

  if (!editor) return null;

  return (
    <button
      type="button"
      className="w-12 px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800"
      onClick={() => {
        if (editor.isActive("math")) {
          editor.chain().focus().unsetLatex().run();
        } else {
          const { from, to } = editor.state.selection;
          const latex = editor.state.doc.textBetween(from, to);
          if (!latex) return;
          editor.chain().focus().setLatex({ latex }).run();
        }
      }}
    >
      <SigmaIcon
        className={`h-4 w-4 ${editor.isActive("math") ? "text-blue-500" : ""}`}
        strokeWidth={2.3}
      />
    </button>
  );
};
