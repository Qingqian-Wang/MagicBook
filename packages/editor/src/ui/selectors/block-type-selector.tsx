"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover";
import { useCurrentEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import {
  Check,
  CheckSquare,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  type LucideIcon,
  TextIcon,
  TextQuote,
} from "lucide-react";
import { BubbleMenuItem } from "../bubble-menu";

export type BlockFormatItem = {
  name: string;
  icon: LucideIcon;
  command: (editor: Editor) => void;
  isActive: (editor: Editor) => boolean;
};

// clearNodes 先把选区还原成段落，再切目标块，避免列表嵌套残留
const items: BlockFormatItem[] = [
  {
    name: "Text",
    icon: TextIcon,
    command: (editor) => editor.chain().focus().clearNodes().run(),
    isActive: (editor) =>
      editor.isActive("paragraph") && !editor.isActive("bulletList") && !editor.isActive("orderedList"),
  },
  {
    name: "Heading 1",
    icon: Heading1,
    command: (editor) => editor.chain().focus().clearNodes().toggleHeading({ level: 1 }).run(),
    isActive: (editor) => editor.isActive("heading", { level: 1 }),
  },
  {
    name: "Heading 2",
    icon: Heading2,
    command: (editor) => editor.chain().focus().clearNodes().toggleHeading({ level: 2 }).run(),
    isActive: (editor) => editor.isActive("heading", { level: 2 }),
  },
  {
    name: "Heading 3",
    icon: Heading3,
    command: (editor) => editor.chain().focus().clearNodes().toggleHeading({ level: 3 }).run(),
    isActive: (editor) => editor.isActive("heading", { level: 3 }),
  },
  {
    name: "To-do List",
    icon: CheckSquare,
    command: (editor) => editor.chain().focus().clearNodes().toggleTaskList().run(),
    isActive: (editor) => editor.isActive("taskItem"),
  },
  {
    name: "Bullet List",
    icon: List,
    command: (editor) => editor.chain().focus().clearNodes().toggleBulletList().run(),
    isActive: (editor) => editor.isActive("bulletList"),
  },
  {
    name: "Numbered List",
    icon: ListOrdered,
    command: (editor) => editor.chain().focus().clearNodes().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive("orderedList"),
  },
  {
    name: "Quote",
    icon: TextQuote,
    command: (editor) => editor.chain().focus().clearNodes().toggleBlockquote().run(),
    isActive: (editor) => editor.isActive("blockquote"),
  },
  {
    name: "Code",
    icon: Code,
    command: (editor) => editor.chain().focus().clearNodes().toggleCodeBlock().run(),
    isActive: (editor) => editor.isActive("codeBlock"),
  },
];

interface BlockTypeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BlockTypeSelector = ({ open, onOpenChange }: BlockTypeSelectorProps) => {
  const { editor } = useCurrentEditor();
  if (!editor) return null;

  const activeItem = items.filter((item) => item.isActive(editor)).pop() ?? { name: "Multiple" };

  return (
    <Popover modal={true} open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          <span>{activeItem.name}</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        sideOffset={5}
        align="start"
        className="z-50 w-48 rounded-md border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900 p-1 shadow-md"
      >
        {items.map((item) => (
          <BubbleMenuItem
            key={item.name}
            onSelect={(instance) => {
              item.command(instance);
              onOpenChange(false);
            }}
            className="flex cursor-pointer items-center justify-between rounded-sm px-2 py-1 text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <div className="flex items-center space-x-2">
              <div className="rounded-sm border border-stone-200 p-1">
                <item.icon className="h-3 w-3" />
              </div>
              <span>{item.name}</span>
            </div>
            {activeItem.name === item.name && <Check className="h-4 w-4" />}
          </BubbleMenuItem>
        ))}
      </PopoverContent>
    </Popover>
  );
};
