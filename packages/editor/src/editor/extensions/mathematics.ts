import { Node, mergeAttributes } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import katex, { type KatexOptions } from "katex";

export interface MathOptions {
  /** 返回 false 时该位置不渲染公式（默认实现：非文本块、代码块内不渲染） */
  shouldRender: (state: EditorState, pos: number) => boolean;
  katexOptions?: KatexOptions;
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    math: {
      /** 把选区内容替换为行内公式节点 */
      setLatex: (props: { latex: string }) => ReturnType;
      /** 把公式节点还原为纯文本 */
      unsetLatex: () => ReturnType;
    };
  }
}

const defaultShouldRender = (state: EditorState, pos: number) => {
  const $pos = state.doc.resolve(pos);
  return $pos.parent.isTextblock && $pos.parent.type.name !== "codeBlock";
};

const applyAttrs = (el: HTMLElement, attrs: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === "string" || typeof value === "number") {
      el.setAttribute(key, String(value));
    }
  }
};

// 行内公式：atom 节点，latex 存属性，NodeView 用 KaTeX 渲染。
// 点击选中整个节点，配合气泡菜单的 MathSelector 做转换/还原。
export const MathNode = Node.create<MathOptions>({
  name: "math",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  marks: "",

  addAttributes() {
    return {
      latex: { default: "" },
    };
  },

  addOptions() {
    return {
      shouldRender: defaultShouldRender,
      katexOptions: { throwOnError: false },
      HTMLAttributes: {},
    };
  },

  addCommands() {
    return {
      setLatex:
        ({ latex }) =>
        ({ chain, state }) => {
          const { from, to, $anchor } = state.selection;
          if (!latex || !this.options.shouldRender(state, $anchor.pos)) return false;
          return chain()
            .insertContentAt({ from, to }, { type: this.name, attrs: { latex } })
            .setTextSelection({ from, to: from + 1 })
            .run();
        },
      unsetLatex:
        () =>
        ({ editor, state, chain }) => {
          const latex = editor.getAttributes(this.name).latex;
          if (typeof latex !== "string") return false;
          const { from, to } = state.selection;
          return chain()
            .command(({ tr }) => {
              tr.insertText(latex, from, to);
              return true;
            })
            .setTextSelection({ from, to: from + latex.length })
            .run();
        },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="math"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": this.name }),
      (node.attrs.latex as string) ?? "",
    ];
  },

  renderText({ node }) {
    return (node.attrs.latex as string) ?? "";
  },

  addNodeView() {
    return ({ node, HTMLAttributes, editor, getPos }) => {
      const dom = document.createElement("span");
      applyAttrs(dom, this.options.HTMLAttributes);
      applyAttrs(dom, HTMLAttributes);
      dom.contentEditable = "false";
      dom.innerHTML = katex.renderToString(
        (node.attrs.latex as string) ?? "",
        this.options.katexOptions,
      );
      dom.addEventListener("click", () => {
        if (!editor.isEditable || typeof getPos !== "function") return;
        const pos = getPos();
        editor.commands.setTextSelection({ from: pos, to: pos + node.nodeSize });
      });
      return { dom };
    };
  },
});

export const mathematics = MathNode.configure({
  HTMLAttributes: {
    class: "text-stone-900 rounded p-1 hover:bg-stone-100 cursor-pointer",
  },
  katexOptions: { throwOnError: false },
});
