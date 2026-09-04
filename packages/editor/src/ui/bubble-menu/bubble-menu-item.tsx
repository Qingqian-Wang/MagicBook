"use client";

import { Slot } from "@radix-ui/react-slot";
import { useCurrentEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

interface BubbleMenuItemProps {
  readonly children: ReactNode;
  readonly asChild?: boolean;
  readonly onSelect?: (editor: Editor) => void;
}

export const BubbleMenuItem = forwardRef<
  HTMLDivElement,
  BubbleMenuItemProps & Omit<ComponentPropsWithoutRef<"div">, "onSelect">
>(({ children, asChild, onSelect, ...rest }, ref) => {
  const { editor } = useCurrentEditor();
  const Comp = asChild ? Slot : "div";

  if (!editor) return null;

  return (
    <Comp ref={ref} {...rest} onClick={() => onSelect?.(editor)}>
      {children}
    </Comp>
  );
});

BubbleMenuItem.displayName = "BubbleMenuItem";
