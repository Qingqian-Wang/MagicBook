import Youtube from "@tiptap/extension-youtube";

export const youtube = Youtube.configure({
  HTMLAttributes: {
    class: "rounded-lg border border-stone-200",
  },
  inline: false,
});
