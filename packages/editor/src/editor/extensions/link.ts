import TiptapLink from "@tiptap/extension-link";

export const link = TiptapLink.configure({
  HTMLAttributes: {
    class: "text-stone-500 underline underline-offset-[3px] hover:text-stone-900 transition-colors cursor-pointer",
  },
});
