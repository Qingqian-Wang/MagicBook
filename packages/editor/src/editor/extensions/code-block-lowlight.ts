import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";

// common 覆盖 37 种常用语言语法，够用的同时控制包体积
export const codeBlockLowlight = CodeBlockLowlight.configure({
  lowlight: createLowlight(common),
  HTMLAttributes: {
    class: "rounded-md bg-stone-100 text-stone-800 border border-stone-200 p-5 font-mono font-medium",
  },
});
