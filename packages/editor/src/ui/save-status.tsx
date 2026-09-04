"use client";

export type SaveStatus = "Saved" | "Unsaved";

export function SaveStatusBadge({ status }: { status: SaveStatus }) {
  return (
    <div className="rounded-lg bg-stone-100 px-2 py-1 text-sm text-stone-500">
      {status === "Saved" ? "已保存" : "未保存"}
    </div>
  );
}
