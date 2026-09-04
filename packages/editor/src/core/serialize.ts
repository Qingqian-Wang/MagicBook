import type { Editor } from "@tiptap/core";
import hljs from "highlight.js";

// Markdown 能力由 editor 层 tiptap-markdown 扩展提供，这里只做取值收敛
export function toMarkdown(editor: Editor): string {
  return (editor.storage as { markdown?: { getMarkdown(): string } }).markdown?.getMarkdown() ?? "";
}

export function toHTML(editor: Editor): string {
  return editor.getHTML();
}

// 导出 HTML 时用 highlight.js 对代码块二次高亮（编辑器内的 lowlight 类名不带配色）
export function highlightCodeblocks(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("pre code").forEach((el) => {
    hljs.highlightElement(el as HTMLElement);
  });
  return new XMLSerializer().serializeToString(doc);
}

// 触发浏览器下载，导出为文件
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
