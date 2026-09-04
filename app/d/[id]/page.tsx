"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import { Moon, Sparkles, Sun } from "lucide-react";
import {
  TextColorSelector,
  Command,
  EditorContent,
  type EditorInstance,
  BubbleMenuPanel,
  EditorRoot,
  ImageResizeHandle,
  type JSONContent,
  LinkEditor,
  MathSelector,
  BlockTypeSelector,
  SaveStatusBadge,
  type SaveStatus,
  SlashCommandMenu,
  FormatButtons,
  defaultExtensions,
  docStore,
  downloadFile,
  extractLinks,
  extractText,
  handleCommandNavigation,
  highlightCodeblocks,
  imageDropHandler,
  imagePasteHandler,
  renderItems,
  suggestionItems,
  toHTML,
  toMarkdown,
  uploadFn,
  wikiIndex,
  type WikiDoc,
} from "@magicbook/editor";
import { Shell } from "../../shell";

const slashCommand = Command.configure({
  suggestion: {
    items: () => suggestionItems,
    render: renderItems,
  },
});

// §10 编辑页：/d/[id]。保存 = 全量 put + 同步 wikiIndex（§11）。
export default function DocPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<WikiDoc | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("Saved");
  const [editor, setEditor] = useState<EditorInstance | null>(null);
  const [openNode, setOpenNode] = useState(false);
  const [openColor, setOpenColor] = useState(false);
  const [openLink, setOpenLink] = useState(false);
  const [words, setWords] = useState(0);
  // 默认浅色；用户手动切换后记忆选择
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("magicbook-theme");
    setDark(saved === "dark");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    window.localStorage.setItem("magicbook-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    docStore.get(id).then((d) => (d ? setDoc(d) : setNotFound(true)));
  }, [id]);

  const debouncedSave = useDebouncedCallback(async (instance: EditorInstance) => {
    if (!doc) return;
    const body = instance.getJSON();
    const updated: WikiDoc = {
      ...doc,
      body,
      text: extractText(body),
      links: extractLinks(body),
      updatedAt: Date.now(),
    };
    await docStore.put(updated);
    wikiIndex.update(updated);
    setDoc(updated);
    setSaveStatus("Saved");
  }, 500);

  if (notFound) {
    return (
      <Shell>
        <div className="p-8 text-sm text-stone-500">文档不存在（可能已被删除）。</div>
      </Shell>
    );
  }
  if (!doc) return null;

  return (
    <Shell currentId={doc.id}>
      <main className="flex min-h-screen flex-col items-center px-4 py-12">
        <div className="relative w-full max-w-screen-lg">
          <div className="absolute right-5 top-5 z-10 mb-5 flex items-center gap-2">
            <SaveStatusBadge status={saveStatus} />
            {words > 0 && (
              <div className="rounded-lg bg-stone-100 px-2 py-1 text-sm text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                {words} Words
              </div>
            )}
            <button
              type="button"
              className="rounded-lg bg-stone-100 px-2 py-1 text-sm text-stone-500 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
              onClick={() => editor && downloadFile(`${doc.title}.md`, toMarkdown(editor), "text/markdown")}
            >
              导出 MD
            </button>
            <button
              type="button"
              aria-label="切换深色模式"
              className="rounded-lg bg-stone-100 px-2 py-1 text-sm text-stone-500 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
              onClick={() => setDark((v) => !v)}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
          <EditorRoot>
            <EditorContent
              initialContent={doc.body as JSONContent}
              extensions={[...defaultExtensions, slashCommand]}
              className="relative min-h-[500px] w-full border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900 sm:mb-[calc(20vh)] sm:rounded-lg sm:border sm:shadow-lg"
              editorProps={{
                handleDOMEvents: {
                  keydown: (_view, event) => handleCommandNavigation(event),
                },
                handlePaste: imagePasteHandler(uploadFn),
                handleDrop: imageDropHandler(uploadFn),
                attributes: {
                  class: "prose prose-lg dark:prose-invert focus:outline-none max-w-full",
                },
              }}
              onCreate={({ editor: instance }) => setEditor(instance)}
              onUpdate={({ editor: instance }) => {
                setWords(instance.storage.characterCount.words());
                setSaveStatus("Unsaved");
                debouncedSave(instance);
              }}
              slotAfter={<ImageResizeHandle />}
            >
              <SlashCommandMenu />
              <BubbleMenuPanel
                tippyOptions={{ placement: "top" }}
                className="flex w-fit max-w-[90vw] overflow-hidden rounded-md border border-stone-200 bg-white shadow-xl dark:border-stone-700 dark:bg-stone-900"
              >
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-2 text-sm text-purple-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                  onClick={() => {
                    if (!editor) return;
                    const { from, to } = editor.state.selection;
                    const text = editor.state.doc.textBetween(from, to, "\n");
                    // 选中文字 → 右栏 Agent（Ask 任务预填），统一走 Wiki Agent
                    window.dispatchEvent(new CustomEvent("mb:ask-ai", { detail: text }));
                    editor.commands.focus();
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  Ask AI
                </button>
                <BlockTypeSelector open={openNode} onOpenChange={setOpenNode} />
                <div className="w-px bg-stone-200" />
                <LinkEditor open={openLink} onOpenChange={setOpenLink} />
                <div className="w-px bg-stone-200" />
                <MathSelector />
                <div className="w-px bg-stone-200" />
                <FormatButtons />
                <div className="w-px bg-stone-200" />
                <TextColorSelector open={openColor} onOpenChange={setOpenColor} />
              </BubbleMenuPanel>
            </EditorContent>
          </EditorRoot>
        </div>
      </main>
    </Shell>
  );
}
