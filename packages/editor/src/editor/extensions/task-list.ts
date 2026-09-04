import { TaskList } from "@tiptap/extension-task-list";

export const taskList = TaskList.configure({
  HTMLAttributes: {
    class: "not-prose pl-2",
  },
});
