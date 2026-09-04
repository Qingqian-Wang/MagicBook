import { InputRule } from "@tiptap/core";
import HorizontalRule from "@tiptap/extension-horizontal-rule";

// 默认输入规则只在行首触发，这里覆盖为在任意位置输入 --- 等都能生成分割线
export const horizontalRule = HorizontalRule.extend({
  addInputRules() {
    return [
      new InputRule({
        find: /^(?:---|—-|___\s|\*\*\*\s)$/u,
        handler: ({ state, range }) => {
          const { tr } = state;
          const start = range.from;
          const end = range.to;

          tr.insert(start - 1, this.type.create({})).delete(tr.mapping.map(start), tr.mapping.map(end));
        },
      }),
    ];
  },
}).configure({
  HTMLAttributes: {
    class: "mt-4 mb-6 border-t border-stone-300",
  },
});
