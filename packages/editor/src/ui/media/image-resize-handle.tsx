"use client";

import { useCurrentEditor } from "@tiptap/react";
import {
  type FC,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface ImageBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const MIN_IMAGE_WIDTH = 40;
const HANDLE_CLASS =
  "pointer-events-auto absolute h-10 w-1.5 -translate-y-1/2 cursor-ew-resize rounded bg-stone-300 hover:bg-stone-400";

// 选中图片时在左右两侧显示拖拽手柄，等比缩放；
// 松手后把最终尺寸写回 image 节点的 width/height 属性（image 扩展持有这两个 attr）。
export const ImageResizeHandle: FC = () => {
  const { editor } = useCurrentEditor();
  const [box, setBox] = useState<ImageBox | null>(null);
  const imgEl = useRef<HTMLImageElement | null>(null);

  // 每次 editor 事务后重新测量选中图片；窗口滚动/缩放也会改变视口坐标，一并监听
  useEffect(() => {
    if (!editor) return;
    const measure = () => {
      if (!editor.isActive("image")) {
        imgEl.current = null;
        setBox(null);
        return;
      }
      const dom = editor.view.nodeDOM(editor.state.selection.from);
      if (!(dom instanceof HTMLImageElement)) {
        imgEl.current = null;
        setBox(null);
        return;
      }
      imgEl.current = dom;
      const rect = dom.getBoundingClientRect();
      setBox({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };
    measure();
    editor.on("transaction", measure);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      editor.off("transaction", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [editor]);

  const commitSize = useCallback(
    (width: number, height: number) => {
      const ed = editor;
      const el = imgEl.current;
      if (!ed || !el) return;
      const pos = ed.state.selection.from;
      const node = ed.state.doc.nodeAt(pos);
      if (!node) return;
      // 清掉拖拽期间写的内联样式，尺寸以节点属性为准
      el.style.width = "";
      el.style.height = "";
      ed.view.dispatch(
        ed.state.tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          width: Math.round(width),
          height: Math.round(height),
        }),
      );
      ed.commands.setNodeSelection(pos);
    },
    [editor],
  );

  const startDrag = useCallback(
    (side: "left" | "right") =>
      (event: ReactPointerEvent<HTMLDivElement>) => {
        const el = imgEl.current;
        if (!el || !box) return;
        event.preventDefault();
        const handle = event.currentTarget;
        handle.setPointerCapture(event.pointerId);

        const direction = side === "left" ? -1 : 1;
        const startX = event.clientX;
        const startWidth = box.width;
        const startHeight = box.height;

        const nextWidth = (clientX: number) =>
          Math.max(MIN_IMAGE_WIDTH, startWidth + direction * (clientX - startX));

        const onMove = (e: PointerEvent) => {
          const width = nextWidth(e.clientX);
          const height = (width / startWidth) * startHeight;
          el.style.width = `${width}px`;
          el.style.height = `${height}px`;
          setBox((prev) => (prev ? { ...prev, width, height } : prev));
        };
        const onUp = (e: PointerEvent) => {
          handle.removeEventListener("pointermove", onMove);
          handle.removeEventListener("pointerup", onUp);
          const width = nextWidth(e.clientX);
          commitSize(width, (width / startWidth) * startHeight);
        };
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
      },
    [box, commitSize],
  );

  if (!box) return null;

  return (
    // 全屏覆盖层不拦截鼠标事件，只有两个手柄可交互
    <div className="pointer-events-none fixed inset-0 z-50">
      <div
        className={HANDLE_CLASS}
        style={{ left: box.left - 8, top: box.top + box.height / 2 }}
        onPointerDown={startDrag("left")}
      />
      <div
        className={HANDLE_CLASS}
        style={{ left: box.left + box.width + 5, top: box.top + box.height / 2 }}
        onPointerDown={startDrag("right")}
      />
    </div>
  );
};
