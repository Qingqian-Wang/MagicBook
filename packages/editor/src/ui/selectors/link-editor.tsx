"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover";
import { useCurrentEditor } from "@tiptap/react";
import { Check, Trash } from "lucide-react";
import { useEffect, useRef } from "react";

export function isValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// 容忍用户省略协议头：包含点且不含空格时补 https://
export function getUrlFromString(str: string) {
  if (isValidUrl(str)) return str;
  try {
    if (str.includes(".") && !str.includes(" ")) {
      return new URL(`https://${str}`).toString();
    }
  } catch {
    return null;
  }
}

interface LinkEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LinkEditor = ({ open, onOpenChange }: LinkEditorProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { editor } = useCurrentEditor();

  useEffect(() => {
    inputRef.current?.focus();
  });
  if (!editor) return null;

  return (
    <Popover modal={true} open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-stone-100 dark:hover:bg-stone-800">
          <p className="text-base">↗</p>
          <p
            className={`underline decoration-stone-400 underline-offset-4 ${
              editor.isActive("link") ? "text-blue-500" : ""
            }`}
          >
            Link
          </p>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        className="z-50 w-60 rounded-md border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900 p-0 shadow-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements[0] as HTMLInputElement;
            const url = getUrlFromString(input.value);
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
              onOpenChange(false);
            }
          }}
          className="flex p-1"
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Paste a link"
            className="flex-1 bg-white dark:bg-stone-900 p-1 text-sm outline-none"
            defaultValue={editor.getAttributes("link").href || ""}
          />
          {editor.getAttributes("link").href ? (
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-sm p-1 text-red-600 transition-all hover:bg-red-100"
              onClick={() => {
                editor.chain().focus().unsetLink().run();
                if (inputRef.current) inputRef.current.value = "";
                onOpenChange(false);
              }}
            >
              <Trash className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              className="flex h-8 w-8 items-center justify-center rounded-sm bg-stone-900 p-1 text-white hover:bg-stone-700"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
        </form>
      </PopoverContent>
    </Popover>
  );
};
