import { Markdown } from "tiptap-markdown";

// tightLists + bulletListMarker 让导出的 Markdown 与 Notion 风格一致；
// 粘贴/复制不做 Markdown 转换，避免与富文本剪贴板冲突
export const markdown = Markdown.configure({
  html: true,
  tightLists: true,
  tightListClass: "tight",
  bulletListMarker: "-",
  linkify: false,
  breaks: false,
  transformPastedText: false,
  transformCopiedText: false,
});
