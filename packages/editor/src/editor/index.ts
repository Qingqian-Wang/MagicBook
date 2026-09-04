export { EditorRoot, EditorContent, type EditorContentProps } from "./editor";
export { defaultExtensions } from "./extensions";
export {
  Command,
  createSuggestionItems,
  type SuggestionItem,
} from "./extensions/slash-command";
export { renderItems, handleCommandNavigation } from "./suggestion/render-items";
export { SlashCommandPortalContext } from "./suggestion/portal";
export { editorStore, queryAtom, rangeAtom } from "./suggestion/atoms";
export {
  ImageUploadPlugin,
  createImageUploader,
  imageDropHandler,
  imagePasteHandler,
  readFileAsDataUrl,
  type ImageUploader,
  type ImageUploaderConfig,
} from "./plugins/upload-images";
export type { Editor as EditorInstance, JSONContent, Range } from "@tiptap/core";
export { useEditor, useCurrentEditor } from "@tiptap/react";
