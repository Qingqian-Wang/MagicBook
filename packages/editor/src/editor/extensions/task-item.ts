import { TaskItem } from "@tiptap/extension-task-item";

export const taskItem = TaskItem.configure({
  HTMLAttributes: {
    class: "flex gap-2 items-start my-4",
  },
  nested: true,
});
