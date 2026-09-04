"use client";

import { useCurrentEditor } from "@tiptap/react";
import { BoldIcon, CodeIcon, ItalicIcon, StrikethroughIcon, UnderlineIcon } from "lucide-react";
import { BubbleMenuItem } from "../bubble-menu";
import type { BlockFormatItem } from "./block-type-selector";

const items: BlockFormatItem[] = [
  {
    name: "bold",
    isActive: (editor) => editor.isActive("bold"),
    command: (editor) => editor.chain().focus().toggleBold().run(),
    icon: BoldIcon,
  },
  {
    name: "italic",
    isActive: (editor) => editor.isActive("italic"),
    command: (editor) => editor.chain().focus().toggleItalic().run(),
    icon: ItalicIcon,
  },
  {
    name: "underline",
    isActive: (editor) => editor.isActive("underline"),
    command: (editor) => editor.chain().focus().toggleUnderline().run(),
    icon: UnderlineIcon,
  },
  {
    name: "strike",
    isActive: (editor) => editor.isActive("strike"),
    command: (editor) => editor.chain().focus().toggleStrike().run(),
    icon: StrikethroughIcon,
  },
  {
    name: "code",
    isActive: (editor) => editor.isActive("code"),
    command: (editor) => editor.chain().focus().toggleCode().run(),
    icon: CodeIcon,
  },
];

export const FormatButtons = () => {
  const { editor } = useCurrentEditor();
  if (!editor) return null;

  return (
    <div className="flex">
      {items.map((item) => (
        <BubbleMenuItem key={item.name} onSelect={(instance) => item.command(instance)}>
          <button type="button" className="px-2.5 py-2 hover:bg-stone-100 dark:hover:bg-stone-800">
            <item.icon className={`h-4 w-4 ${item.isActive(editor) ? "text-blue-500" : ""}`} />
          </button>
        </BubbleMenuItem>
      ))}
    </div>
  );
};
