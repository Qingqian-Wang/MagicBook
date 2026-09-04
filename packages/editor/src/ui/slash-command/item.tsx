"use client";

import { CommandItem } from "cmdk";
import { useAtomValue } from "jotai";
import type { FC } from "react";
import { type SuggestionItem, rangeAtom, useCurrentEditor } from "../../editor";

// searchTerms 透传给 cmdk 的 keywords，否则模糊搜索只匹配 title
export const SlashCommandItem: FC<{ item: SuggestionItem }> = ({ item }) => {
  const { editor } = useCurrentEditor();
  const range = useAtomValue(rangeAtom);

  if (!editor || !range) return null;

  return (
    <CommandItem
      value={item.title}
      keywords={item.searchTerms}
      onSelect={() => item.command?.({ editor, range })}
      className="flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-sm hover:bg-stone-100 aria-selected:bg-stone-100 dark:hover:bg-stone-800 dark:aria-selected:bg-stone-800"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-stone-200 bg-white">
        {item.icon}
      </div>
      <div>
        <p className="font-medium">{item.title}</p>
        <p className="text-xs text-stone-500">{item.description}</p>
      </div>
    </CommandItem>
  );
};
