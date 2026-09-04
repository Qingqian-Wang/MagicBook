import { Extension } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockSelection: {
      /** 把选区扩展到所覆盖块的完整文本范围 */
      extendSelectionToBlockBounds: () => ReturnType;
    };
  }
}

// Mod-A 分两段（Notion 行为）：第一次按下只选中当前块的文本，
// 再次按下时选区已贴齐块边界、命令返回 false，快捷键回落到编辑器默认的全选。
export const blockSelection = Extension.create({
  name: "BlockSelection",

  addCommands() {
    return {
      extendSelectionToBlockBounds:
        () =>
        ({ state, commands }) => {
          const { selection } = state;
          const blockTextStart = selection.$from.start();
          const blockTextEnd = selection.$to.end();

          // 已覆盖整块文本（含空块）时不再收缩，交给默认全选
          if (selection.from <= blockTextStart && selection.to >= blockTextEnd) {
            return false;
          }
          return commands.setTextSelection(
            TextSelection.create(state.doc, blockTextStart, blockTextEnd),
          );
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-a": () => this.editor.commands.extendSelectionToBlockBounds(),
    };
  },
});
