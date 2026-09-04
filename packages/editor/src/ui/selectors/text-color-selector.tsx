"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover";
import { useCurrentEditor } from "@tiptap/react";
import { Check, ChevronDown } from "lucide-react";
import { BubbleMenuItem } from "../bubble-menu";

export interface ColorSwatch {
  name: string;
  color: string;
}

// 高亮色用浅底色系，与常见笔记软件一致
const TEXT_COLORS: ColorSwatch[] = [
  { name: "Default", color: "#171717" },
  { name: "Purple", color: "#9333EA" },
  { name: "Red", color: "#E00000" },
  { name: "Yellow", color: "#EAB308" },
  { name: "Blue", color: "#2563EB" },
  { name: "Green", color: "#008A00" },
  { name: "Orange", color: "#FFA500" },
  { name: "Pink", color: "#BA4081" },
  { name: "Gray", color: "#A8A29E" },
];

const HIGHLIGHT_COLORS: ColorSwatch[] = [
  { name: "Default", color: "#FFFFFF" },
  { name: "Purple", color: "#F6F3F8" },
  { name: "Red", color: "#FDEBEB" },
  { name: "Yellow", color: "#FBF4A2" },
  { name: "Blue", color: "#C1ECF9" },
  { name: "Green", color: "#ACF79F" },
  { name: "Orange", color: "#FAEBDD" },
  { name: "Pink", color: "#FAF1F5" },
  { name: "Gray", color: "#F1F1EF" },
];

interface TextColorSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TextColorSelector = ({ open, onOpenChange }: TextColorSelectorProps) => {
  const { editor } = useCurrentEditor();
  if (!editor) return null;

  const activeColorItem = TEXT_COLORS.find(({ color }) => editor.isActive("textStyle", { color }));
  const activeHighlightItem = HIGHLIGHT_COLORS.find(({ color }) => editor.isActive("highlight", { color }));

  return (
    <Popover modal={true} open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-stone-100 dark:hover:bg-stone-800">
          <span
            className="rounded-sm px-1"
            style={{
              color: activeColorItem?.color,
              backgroundColor: activeHighlightItem?.color,
            }}
          >
            A
          </span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        sideOffset={5}
        align="start"
        className="z-50 my-1 flex max-h-80 w-48 flex-col overflow-y-auto rounded-md border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900 p-1 shadow-xl"
      >
        <div className="flex flex-col">
          <div className="my-1 px-2 text-sm font-semibold text-stone-500">Color</div>
          {TEXT_COLORS.map(({ name, color }) => (
            <BubbleMenuItem
              key={name}
              onSelect={(instance) => {
                instance.commands.unsetColor();
                if (name !== "Default") instance.chain().focus().setColor(color).run();
                onOpenChange(false);
              }}
              className="flex cursor-pointer items-center justify-between px-2 py-1 text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <div className="flex items-center gap-2">
                <div className="rounded-sm border border-stone-200 px-2 py-px font-medium" style={{ color }}>
                  A
                </div>
                <span>{name}</span>
              </div>
              {editor.isActive("textStyle", { color }) && <Check className="h-4 w-4" />}
            </BubbleMenuItem>
          ))}
        </div>
        <div>
          <div className="my-1 px-2 text-sm font-semibold text-stone-500">Background</div>
          {HIGHLIGHT_COLORS.map(({ name, color }) => (
            <BubbleMenuItem
              key={name}
              onSelect={(instance) => {
                instance.commands.unsetHighlight();
                if (name !== "Default") instance.chain().focus().setHighlight({ color }).run();
                onOpenChange(false);
              }}
              className="flex cursor-pointer items-center justify-between px-2 py-1 text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <div className="flex items-center gap-2">
                <div
                  className="rounded-sm border border-stone-200 px-2 py-px font-medium"
                  style={{ backgroundColor: color }}
                >
                  A
                </div>
                <span>{name}</span>
              </div>
              {editor.isActive("highlight", { color }) && <Check className="h-4 w-4" />}
            </BubbleMenuItem>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
