"use client";

import { Moon, Sun, Translate } from "@phosphor-icons/react";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";

/** 登录页底部的语言 / 主题快捷切换；登录后在「设置 › 外观」里有完整选项 */
export function ThemeLanguageToggle() {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const languageLabel = language === "zh" ? t("switch_to_english") : t("switch_to_chinese");
  const themeLabel = theme === "dark" ? t("switch_to_light") : t("switch_to_dark");

  return (
    <>
      <button
        type="button"
        onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
        className="btn btn-sm btn-plain text-label-2"
        aria-label={languageLabel}
      >
        <Translate size={17} weight="bold" aria-hidden />
        {language === "zh" ? "English" : "中文"}
      </button>
      <button
        type="button"
        onClick={toggleTheme}
        className="icon-btn text-label-2"
        aria-label={themeLabel}
        title={themeLabel}
      >
        {theme === "dark" ? <Sun size={19} weight="bold" aria-hidden /> : <Moon size={19} weight="bold" aria-hidden />}
      </button>
    </>
  );
}
