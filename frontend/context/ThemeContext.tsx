"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "tg-signer-theme";
/** 页面没有色区时的状态栏颜色，与中性色区一致 */
const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#3c4b5e",
  dark: "#243040",
};

/** 内联到 <head>：首帧前按「保存的偏好 → 系统设置」给 <html> 加 dark 类 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${STORAGE_KEY}');var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

interface ThemeContextType {
  /** 用户选择：跟随系统 / 浅色 / 深色 */
  preference: ThemePreference;
  /** 实际生效的主题 */
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const readPreference = (): ThemePreference => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    // 隐私模式等场景下 localStorage 不可用，回退到跟随系统
  }
  return "system";
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPreferenceState(readPreference());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(media.matches);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", onChange);
    setReady(true);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const theme: ResolvedTheme =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    // 状态栏跟随当前页面的色区
    const field = document.querySelector<HTMLElement>(".field-bar, .field");
    const color = (field && getComputedStyle(field).getPropertyValue("--field").trim()) || THEME_COLORS[theme];
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", color));
  }, [theme, ready]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 忽略存储失败，本次会话内仍然生效
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(theme === "dark" ? "light" : "dark");
  }, [theme, setPreference]);

  const value = useMemo(
    () => ({ preference, theme, setPreference, toggleTheme }),
    [preference, theme, setPreference, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
