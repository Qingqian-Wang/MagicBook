import { isNodeEmpty } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// 官方 Placeholder 的 isNodeEmpty 是递归判空：只装着空段落的 ul/li 也算「空」。
// includeChildren + 光标在块内（hasAnchor 对所有祖先层都成立）⇒ 容器层和段落层
// 各挂一份占位装饰，同一空列表项会渲染出两三条 "Press '/' for commands"。
// 这里重写插件：只给包含光标的空「文本块」（段落/标题/代码块）挂占位，容器层不挂。
export const placeholder = Placeholder.extend({
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("placeholder"),
        props: {
          decorations: ({ doc, selection }) => {
            const active = this.editor.isEditable || !this.options.showOnlyWhenEditable;
            if (!active) return null;

            const { anchor } = selection;
            const isEmptyDoc = this.editor.isEmpty;
            const decorations: Decoration[] = [];

            doc.descendants((node, pos) => {
              const hasAnchor = anchor >= pos && anchor <= pos + node.nodeSize;
              if (!node.isTextblock || !isNodeEmpty(node)) return true;
              if (!hasAnchor && this.options.showOnlyCurrent) return true;

              const classes = [this.options.emptyNodeClass];
              if (isEmptyDoc) {
                classes.push(this.options.emptyEditorClass);
              }
              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: classes.join(" "),
                  "data-placeholder":
                    typeof this.options.placeholder === "function"
                      ? this.options.placeholder({
                          editor: this.editor,
                          node,
                          pos,
                          hasAnchor,
                        })
                      : this.options.placeholder,
                }),
              );
              return true;
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
}).configure({
  placeholder: ({ node }) => {
    if (node.type.name === "heading") {
      return `Heading ${node.attrs.level}`;
    }
    return "Press '/' for commands";
  },
});
