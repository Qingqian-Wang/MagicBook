import { codeBlockLowlight } from "./code-block-lowlight";
import { blockSelection } from "./block-selection";
import { characterCount, globalDragHandle } from "./global-drag-handle";
import { horizontalRule } from "./horizontal-rule";
import { image } from "./image";
import { link } from "./link";
import { markdown } from "./markdown";
import { mathematics } from "./mathematics";
import { placeholder } from "./placeholder";
import { starterKit } from "./starter-kit";
import { taskItem } from "./task-item";
import { taskList } from "./task-list";
import { color, highlight, textStyle } from "./text-style";
import { twitter } from "./twitter";
import { underline } from "./underline";
import { youtube } from "./youtube";

export const defaultExtensions = [
  starterKit,
  placeholder,
  codeBlockLowlight,
  horizontalRule,
  taskList,
  taskItem,
  link,
  underline,
  textStyle,
  color,
  highlight,
  markdown,
  image,
  youtube,
  twitter,
  mathematics,
  blockSelection,
  characterCount,
  globalDragHandle,
];
