"use client";

import { EditorProvider } from "@tiptap/react";
import type { EditorProviderProps, JSONContent } from "@tiptap/react";
import { Provider } from "jotai";
import { forwardRef, useRef } from "react";
import type { FC, ReactNode } from "react";
import tunnel from "tunnel-rat";
import { editorStore } from "./suggestion/atoms";
import { SlashCommandPortalContext } from "./suggestion/portal";

export interface EditorRootProps {
  readonly children: ReactNode;
}

// 装配点：斜杠菜单的弹层在编辑器 React 树外渲染，
// 通过 portal + 共享 store 与树内的菜单 JSX 通信
export const EditorRoot: FC<EditorRootProps> = ({ children }) => {
  const portalInstance = useRef(tunnel()).current;

  return (
    <Provider store={editorStore}>
      <SlashCommandPortalContext.Provider value={portalInstance}>
        {children}
      </SlashCommandPortalContext.Provider>
    </Provider>
  );
};

export type EditorContentProps = Omit<EditorProviderProps, "content"> & {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly initialContent?: JSONContent;
};

export const EditorContent = forwardRef<HTMLDivElement, EditorContentProps>(
  ({ className, children, initialContent, ...rest }, ref) => (
    <div ref={ref} className={className}>
      <EditorProvider immediatelyRender={false} {...rest} content={initialContent}>
        {children}
      </EditorProvider>
    </div>
  ),
);

EditorContent.displayName = "EditorContent";
