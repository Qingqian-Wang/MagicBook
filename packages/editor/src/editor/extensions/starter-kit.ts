import StarterKit from "@tiptap/starter-kit";

// codeBlock / horizontalRule 关掉：分别由 lowlight 高亮版和带自定义输入规则的版本替代
export const starterKit = StarterKit.configure({
  bulletList: {
    HTMLAttributes: {
      class: "list-disc list-outside leading-3 -mt-2",
    },
  },
  orderedList: {
    HTMLAttributes: {
      class: "list-decimal list-outside leading-3 -mt-2",
    },
  },
  listItem: {
    HTMLAttributes: {
      class: "leading-normal -mb-2",
    },
  },
  blockquote: {
    HTMLAttributes: {
      class: "border-l-4 border-stone-300",
    },
  },
  code: {
    HTMLAttributes: {
      class: "rounded-md bg-stone-100 px-1.5 py-1 font-mono font-medium",
      spellcheck: "false",
    },
  },
  codeBlock: false,
  horizontalRule: false,
  dropcursor: {
    color: "#DBEAFE",
    width: 4,
  },
  gapcursor: false,
});
