import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";

export const textStyle = TextStyle;
export const color = Color;

// multicolor 允许同一文档内多种高亮色并存
export const highlight = Highlight.configure({
  multicolor: true,
});
