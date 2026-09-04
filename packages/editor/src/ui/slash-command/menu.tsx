"use client";

import { Command } from "cmdk";
import { useAtom } from "jotai";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, FC } from "react";
import { SlashCommandPortalContext, queryAtom } from "../../editor";
import { suggestionItems } from "./items";
import { SlashCommandItem } from "./item";

// cmdk 负责模糊搜索与键盘选中态；隐藏 Input 只作为 query 的载体
export const EditorCommand = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof Command>>(
  ({ children, className, ...rest }, ref) => {
    const [query, setQuery] = useAtom(queryAtom);

    return (
      <SlashCommandPortalContext.Consumer>
        {(portalInstance) => (
          <portalInstance.In>
            <Command
              ref={ref}
              onKeyDown={(e) => e.stopPropagation()}
              id="slash-command"
              className={className}
              {...rest}
            >
              <Command.Input value={query} onValueChange={setQuery} className="hidden" />
              {children}
            </Command>
          </portalInstance.In>
        )}
      </SlashCommandPortalContext.Consumer>
    );
  },
);

EditorCommand.displayName = "EditorCommand";

export const SlashCommandMenu: FC = () => (
  <EditorCommand className="z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900 px-1 py-2 shadow-md transition-all">
    <Command.Empty className="px-2 text-stone-500">No results</Command.Empty>
    <Command.List>
      {suggestionItems.map((item) => (
        <SlashCommandItem key={item.title} item={item} />
      ))}
    </Command.List>
  </EditorCommand>
);
