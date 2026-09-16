/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  future: {
    // 触屏设备上不触发 hover 样式，避免点按后高亮卡住
    hoverOnlyWhenSupported: true,
  },
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        sheet: "var(--sheet-bg)",
        fill: "var(--fill)",
        "fill-strong": "var(--fill-strong)",
        pressed: "var(--pressed)",
        label: "var(--label)",
        "label-2": "var(--label-2)",
        "label-3": "var(--label-3)",
        faint: "var(--faint)",
        up: "var(--up)",
        down: "var(--down)",
        separator: "var(--separator)",
        accent: {
          DEFAULT: "var(--accent)",
          text: "var(--accent-text)",
          soft: "var(--accent-soft)",
        },
        success: {
          DEFAULT: "var(--success)",
          dot: "var(--success-dot)",
          soft: "var(--success-soft)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          dot: "var(--danger-dot)",
          soft: "var(--danger-soft)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          dot: "var(--warning-dot)",
          soft: "var(--warning-soft)",
        },
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      fontSize: {
        "large-title": ["34px", { lineHeight: "41px", fontWeight: "700" }],
        title1: ["28px", { lineHeight: "34px", fontWeight: "700" }],
        title2: ["22px", { lineHeight: "28px", fontWeight: "700" }],
        title3: ["20px", { lineHeight: "25px", fontWeight: "600" }],
        headline: ["17px", { lineHeight: "22px", fontWeight: "600" }],
        body: ["17px", { lineHeight: "22px" }],
        callout: ["16px", { lineHeight: "21px" }],
        subhead: ["15px", { lineHeight: "20px" }],
        footnote: ["13px", { lineHeight: "18px" }],
        caption: ["12px", { lineHeight: "16px" }],
        caption2: ["11px", { lineHeight: "13px" }],
      },
      borderRadius: {
        group: "18px",
        sheet: "22px",
      },
      boxShadow: {
        float: "0 12px 32px -8px rgba(15,23,32,0.28), 0 1px 3px rgba(15,23,32,0.08)",
        lift: "var(--lift-shadow)",
        thumb: "0 3px 8px rgba(0,0,0,0.15), 0 3px 1px rgba(0,0,0,0.06)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        sheet: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [],
};
