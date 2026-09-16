import { GearSix, ListChecks, UsersThree } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useLanguage } from "../../context/LanguageContext";

export interface NavTab {
  key: "tasks" | "accounts" | "settings";
  href: string;
  label: string;
  icon: Icon;
  active: boolean;
}

const normalize = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

/** 三个一级页面：手机底部 Tab 与桌面色区导航共用 */
export function useNavTabs(pathname: string): NavTab[] {
  const { t } = useLanguage();
  const path = normalize(pathname);
  return [
    {
      key: "tasks",
      href: "/dashboard",
      label: t("tab_tasks"),
      icon: ListChecks,
      active: path === "/dashboard" || path.startsWith("/dashboard/sign-tasks"),
    },
    {
      key: "accounts",
      href: "/dashboard/accounts",
      label: t("tab_accounts"),
      icon: UsersThree,
      active: path.startsWith("/dashboard/accounts"),
    },
    {
      key: "settings",
      href: "/dashboard/settings",
      label: t("tab_settings"),
      icon: GearSix,
      active: path.startsWith("/dashboard/settings"),
    },
  ];
}
