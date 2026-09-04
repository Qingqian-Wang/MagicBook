import type { Range } from "@tiptap/core";
import { atom, createStore } from "jotai";

// 弹层宿主（ReactRenderer 渲染，在 React 树外）与菜单（React 树内）靠同一个 store 通信
export const editorStore = createStore();
export const queryAtom = atom("");
export const rangeAtom = atom<Range | null>(null);
