import { type EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Slice } from "@tiptap/pm/model";

interface PendingImage {
  id: object;
  pos: number;
  src: string;
}

interface UploadState {
  /** 进行中的上传：id → 插入点与预览图，查询 O(1)，不依赖装饰集扫描 */
  pending: Map<object, PendingImage>;
  decorations: DecorationSet;
}

type UploadCommand =
  | { type: "begin"; image: PendingImage }
  | { type: "end"; id: object };

const uploadStateKey = new PluginKey<UploadState>("image-upload-placeholder");

// 上传未完成时在插入点挂半透明预览图（widget decoration），上传结束后替换为 image 节点。
// 占位状态存 Map，DecorationSet 只负责渲染；两者在 apply 里随事务同步。
export const ImageUploadPlugin = ({ imageClass }: { imageClass: string }) =>
  new Plugin<UploadState>({
    key: uploadStateKey,
    state: {
      init: () => ({ pending: new Map(), decorations: DecorationSet.empty }),
      apply(tr, prev) {
        const command = tr.getMeta(uploadStateKey) as UploadCommand | undefined;
        if (!command && !tr.docChanged) return prev;

        let decorations = prev.decorations.map(tr.mapping, tr.doc);
        let pending = prev.pending;

        if (command) {
          pending = new Map(prev.pending);
          if (command.type === "begin") {
            pending.set(command.image.id, command.image);
            decorations = decorations.add(tr.doc, [
              placeholderDecoration(command.image, imageClass),
            ]);
          } else {
            pending.delete(command.id);
            const stale = decorations.find(
              undefined,
              undefined,
              (spec) => spec.id === command.id,
            );
            decorations = decorations.remove(stale);
          }
        }
        return { pending, decorations };
      },
    },
    props: {
      decorations: (state) => uploadStateKey.getState(state)?.decorations,
    },
  });

function placeholderDecoration(image: PendingImage, imageClass: string) {
  const wrapper = document.createElement("div");
  wrapper.className = "img-placeholder";
  const preview = document.createElement("img");
  preview.className = imageClass;
  preview.src = image.src;
  wrapper.appendChild(preview);
  // +1：落到目标块内部，避免包出空节点
  return Decoration.widget(image.pos + 1, wrapper, { id: image.id });
}

function pendingPos(state: EditorState, id: object) {
  return uploadStateKey.getState(state)?.pending.get(id)?.pos ?? null;
}

/** 读本地文件为 data URL，占位预览与“上传不可用”时的回退都依赖它 */
export const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export interface ImageUploaderConfig {
  /** 返回 false 时丢弃该文件 */
  validate?: (file: File) => boolean;
  /** 返回图片 URL；返回非字符串（如原 File）则回退用本地 data URL */
  upload: (file: File) => Promise<string | File>;
}

export type ImageUploader = (file: File, view: EditorView, pos: number) => void;

export const createImageUploader =
  ({ validate, upload }: ImageUploaderConfig): ImageUploader =>
  (file, view, pos) => {
    if (validate && !validate(file)) return;

    const id = {};
    const insert = view.state.tr;
    if (!insert.selection.empty) insert.deleteSelection();

    // 先用本地 data URL 显示预览，上传期间不阻塞编辑
    readFileAsDataUrl(file).then((preview) => {
      view.dispatch(
        insert.setMeta(uploadStateKey, { type: "begin", image: { id, pos, src: preview } }),
      );

      upload(file).then(
        (result) => {
          // 占位已被用户清掉时放弃插入
          const at = pendingPos(view.state, id);
          if (at == null) return;
          const imageType = view.state.schema.nodes.image;
          if (!imageType) return;
          const src = typeof result === "string" ? result : preview;
          view.dispatch(
            view.state.tr
              .replaceWith(at, at, imageType.create({ src }))
              .setMeta(uploadStateKey, { type: "end", id }),
          );
        },
        () => {
          // 上传失败：仅移除占位，不动文档
          view.dispatch(view.state.tr.setMeta(uploadStateKey, { type: "end", id }));
        },
      );
    });
  };

/** 粘贴图片文件时拦截默认行为，交给 uploader 处理 */
export const imagePasteHandler =
  (uploader: ImageUploader) => (view: EditorView, event: ClipboardEvent) => {
    const file = event.clipboardData?.files[0];
    if (!file) return false;
    event.preventDefault();
    uploader(file, view, view.state.selection.from);
    return true;
  };

/** 拖入文件（非编辑器内移动）时拦截默认行为，插入点取鼠标落点 */
export const imageDropHandler =
  (uploader: ImageUploader) =>
  (
    view: EditorView,
    event: DragEvent,
    _slice: Slice,
    moved: boolean,
  ): boolean => {
    if (moved) return false;
    const file = event.dataTransfer?.files[0];
    if (!file) return false;
    event.preventDefault();
    const drop = view.posAtCoords({ left: event.clientX, top: event.clientY });
    // posAtCoords 给的是光标位置，-1 让图片落在该块之前而不是包进空段落
    uploader(file, view, (drop?.pos ?? 0) - 1);
    return true;
  };
