"use client";

import type { Editor, Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import { useSetAtom } from "jotai";
import { useEffect } from "react";
import type { FC, RefObject } from "react";
import tippy, { type GetReferenceClientRect, type Instance, type Props } from "tippy.js";
import { editorStore, queryAtom, rangeAtom } from "./atoms";
import { SlashCommandPortalContext } from "./portal";

interface EditorCommandOutProps {
  readonly query: string;
  readonly range: Range;
}

// 弹层内的宿主组件：同步 query/range 到 store，并把键盘导航转发给 cmdk
const EditorCommandOut: FC<EditorCommandOutProps> = ({ query, range }) => {
  const setQuery = useSetAtom(queryAtom, { store: editorStore });
  const setRange = useSetAtom(rangeAtom, { store: editorStore });

  useEffect(() => {
    setQuery(query);
  }, [query, setQuery]);

  useEffect(() => {
    setRange(range);
  }, [range, setRange]);

  useEffect(() => {
    const navigationKeys = ["ArrowUp", "ArrowDown", "Enter"];
    const onKeyDown = (e: KeyboardEvent) => {
      if (navigationKeys.includes(e.key)) {
        e.preventDefault();
        document.querySelector("#slash-command")?.dispatchEvent(
          new KeyboardEvent("keydown", { key: e.key, cancelable: true, bubbles: true }),
        );
        return false;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <SlashCommandPortalContext.Consumer>
      {(portalInstance) => <portalInstance.Out />}
    </SlashCommandPortalContext.Consumer>
  );
};

// 菜单打开时截获方向键/回车，避免 ProseMirror 移动光标
export const handleCommandNavigation = (event: KeyboardEvent) => {
  if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
    const slashCommand = document.querySelector("#slash-command");
    if (slashCommand) {
      return true;
    }
  }
};

export const renderItems = (elementRef?: RefObject<Element> | null) => {
  let component: ReactRenderer | null = null;
  let popup: Instance<Props>[] | null = null;

  return {
    onStart: (props: { editor: Editor; clientRect: DOMRect }) => {
      const { selection } = props.editor.state;
      const parentNode = selection.$from.node(selection.$from.depth);

      // 代码块里输入 / 不弹菜单
      if (parentNode.type.name === "codeBlock") {
        return false;
      }

      component = new ReactRenderer(EditorCommandOut, {
        props,
        editor: props.editor,
      });

      popup = tippy("body", {
        getReferenceClientRect: props.clientRect as unknown as GetReferenceClientRect,
        appendTo: () => elementRef?.current ?? document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: "manual",
        placement: "bottom-start",
      });
    },
    onUpdate: (props: { editor: Editor; clientRect: GetReferenceClientRect }) => {
      component?.updateProps(props);

      popup?.[0]?.setProps({
        getReferenceClientRect: props.clientRect,
      });
    },
    onKeyDown: (props: { event: KeyboardEvent }) => {
      if (props.event.key === "Escape") {
        popup?.[0]?.hide();
        return true;
      }
      return (component?.ref as { onKeyDown?: (p: unknown) => boolean } | null)?.onKeyDown?.(props) ?? false;
    },
    onExit: () => {
      popup?.[0]?.destroy();
      component?.destroy();
    },
  };
};
