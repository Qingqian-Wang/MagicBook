import GlobalDragHandle from "tiptap-extension-global-drag-handle";
import CharacterCount from "@tiptap/extension-character-count";

// 块级拖拽手柄：悬停块左侧出现，拖动重排
export const globalDragHandle = GlobalDragHandle.configure({});

export const characterCount = CharacterCount.configure();
