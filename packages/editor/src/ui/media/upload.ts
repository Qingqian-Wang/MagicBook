import { createImageUploader, readFileAsDataUrl } from "../../editor";

// 默认上传实现：本地读取为 data URL（local-first，无需后端）。
// 如需云端存储，在 app 组装层用 createImageUploader 换成自己的 upload（如 Vercel Blob）。
export const uploadFn = createImageUploader({
  upload: readFileAsDataUrl,
  validate: (file) => {
    if (!file.type.includes("image/")) {
      console.warn("File type not supported:", file.type);
      return false;
    }
    if (file.size / 1024 / 1024 > 20) {
      console.warn("File size too big (max 20MB).");
      return false;
    }
    return true;
  },
});
