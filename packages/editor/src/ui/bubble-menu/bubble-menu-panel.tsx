"use client";

import { BubbleMenu, isNodeSelection, useCurrentEditor } from "@tiptap/react";
import type { BubbleMenuProps } from "@tiptap/react";
import { forwardRef, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import type { Instance, Props } from "tippy.js";

export interface BubbleMenuPanelProps extends Omit<BubbleMenuProps, "editor"> {
  readonly children: ReactNode;
}

export const BubbleMenuPanel = forwardRef<HTMLDivElement, BubbleMenuPanelProps>(
  ({ children, tippyOptions, ...rest }, ref) => {
    const { editor: currentEditor } = useCurrentEditor();
    const instanceRef = useRef<Instance<Props> | null>(null);

    useEffect(() => {
      if (!instanceRef.current || !tippyOptions?.placement) return;

      instanceRef.current.setProps({ placement: tippyOptions.placement });
      instanceRef.current.popperInstance?.update();
    }, [tippyOptions?.placement]);

    const bubbleMenuProps: Omit<BubbleMenuProps, "children"> = useMemo(() => {
      const shouldShow: BubbleMenuProps["shouldShow"] = ({ editor, state }) => {
        const { selection } = state;

        // 不可编辑 / 选中图片 / 空选区 / 节点选区（拖拽手柄）时不弹气泡
        if (!editor.isEditable || editor.isActive("image") || selection.empty || isNodeSelection(selection)) {
          return false;
        }
        return true;
      };

      return {
        shouldShow,
        tippyOptions: {
          onCreate: (val) => {
            instanceRef.current = val;
            // 避免输入时气泡内元素夺走编辑器焦点
            instanceRef.current.popper.firstChild?.addEventListener("blur", (event) => {
              event.preventDefault();
              event.stopImmediatePropagation();
            });
          },
          moveTransition: "transform 0.15s ease-out",
          ...tippyOptions,
        },
        editor: currentEditor,
        ...rest,
      };
    }, [currentEditor, rest, tippyOptions]);

    if (!currentEditor) return null;

    // 外层 div 解决 https://github.com/ueberdosis/tiptap/issues/2658
    return (
      <div ref={ref}>
        <BubbleMenu {...bubbleMenuProps}>{children}</BubbleMenu>
      </div>
    );
  },
);

BubbleMenuPanel.displayName = "BubbleMenuPanel";
