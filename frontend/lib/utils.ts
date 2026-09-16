import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// 自定义字号（text-headline 等）需要告诉 tailwind-merge，否则会被当成颜色类与 text-label 互相覆盖
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "large-title",
            "title1",
            "title2",
            "title3",
            "headline",
            "body",
            "callout",
            "subhead",
            "footnote",
            "caption",
            "caption2",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

/** 替换文案中的 {name} 形式占位符 */
export function fmt(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match
  );
}
