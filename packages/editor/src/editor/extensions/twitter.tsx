import { Node, mergeAttributes, nodePasteRule } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { Tweet } from "react-tweet";

export const TWITTER_REGEX = /^https?:\/\/(www\.)?x\.com\/([a-zA-Z0-9_]{1,15})(\/status\/(\d+))?(\/\S*)?$/;
export const TWITTER_REGEX_GLOBAL = /(https?:\/\/)?(www\.)?x\.com\/([a-zA-Z0-9_]{1,15})(\/status\/(\d+))?(\/\S*)?/g;

export const isValidTwitterUrl = (url: string) => url.match(TWITTER_REGEX);

const TweetComponent = ({ node }: { node: { attrs: Record<string, string> } }) => {
  const url = node.attrs.src;
  const tweetId = url?.split("/").pop();

  if (!tweetId) {
    return null;
  }

  return (
    <NodeViewWrapper>
      <div data-twitter="">
        <Tweet id={tweetId} />
      </div>
    </NodeViewWrapper>
  );
};

export interface TwitterOptions {
  addPasteHandler: boolean;
  HTMLAttributes: Record<string, string>;
  inline: boolean;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    twitter: {
      setTweet: (options: { src: string }) => ReturnType;
    };
  }
}

export const Twitter = Node.create<TwitterOptions>({
  name: "twitter",

  addOptions() {
    return {
      addPasteHandler: true,
      HTMLAttributes: {},
      inline: false,
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(TweetComponent, { attrs: this.options.HTMLAttributes });
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? "inline" : "block";
  },

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-twitter]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-twitter": "" }, HTMLAttributes)];
  },

  addCommands() {
    return {
      setTweet:
        (options: { src: string }) =>
        ({ commands }) => {
          if (!isValidTwitterUrl(options.src)) {
            return false;
          }
          return commands.insertContent({ type: this.name, attrs: options });
        },
    };
  },

  addPasteRules() {
    if (!this.options.addPasteHandler) {
      return [];
    }
    return [
      nodePasteRule({
        find: TWITTER_REGEX_GLOBAL,
        type: this.type,
        getAttributes: (match) => ({ src: match.input }),
      }),
    ];
  },
});

export const twitter = Twitter.configure({
  HTMLAttributes: {
    class: "not-prose",
  },
  inline: false,
});
