import Image from "@tiptap/extension-image";
import { ImageUploadPlugin } from "../plugins/upload-images";

// 在官方 Image 上补 width/height 属性（供 ImageResizeHandle 持久化尺寸）+ 粘贴/拖拽上传的占位插件
export const image = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
      },
      height: {
        default: null,
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      ImageUploadPlugin({
        imageClass: "opacity-40 rounded-lg border border-stone-200",
      }),
    ];
  },
}).configure({
  allowBase64: true,
  HTMLAttributes: {
    class: "rounded-lg border border-stone-200",
  },
});
