"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getToken } from "../../lib/auth";
import { cn } from "../../lib/utils";
import { useLanguage } from "../../context/LanguageContext";
import { DashboardDataProvider, useAccountAlerts } from "./DashboardData";
import { useNavTabs } from "./nav";
import { SelfUpdateProvider, useSelfUpdate } from "./SelfUpdate";

function TabBar() {
  const { t } = useLanguage();
  const tabs = useNavTabs(usePathname() || "/dashboard");
  const alerts = useAccountAlerts();
  const { updateAvailable } = useSelfUpdate();
  return (
    <nav aria-label={t("main_navigation")} className="material hairline-top fixed inset-x-0 bottom-0 z-40 pb-safe lg:hidden">
      <div className="mx-auto grid h-[var(--tabbar-h)] max-w-[560px] grid-cols-3 px-safe">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-[3px] transition-colors duration-150 active:opacity-60",
                tab.active ? "text-accent-text" : "text-label-3"
              )}
            >
              <span className="relative">
                <TabIcon size={26} weight={tab.active ? "fill" : "regular"} aria-hidden />
                {tab.key === "accounts" && alerts > 0 ? (
                  <span className="num absolute -right-3 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-down px-[5px] text-[11px] font-bold leading-none text-white ring-2 ring-[var(--surface)]">
                    {alerts}
                  </span>
                ) : null}
                {tab.key === "settings" && updateAvailable ? (
                  <span className="absolute -right-0.5 top-0 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-[var(--surface)]">
                    <span className="sr-only">{t("update_available_short")}</span>
                  </span>
                ) : null}
              </span>
              <span className="text-[10.5px] font-semibold leading-[12px]">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/dashboard";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      window.location.replace("/");
      return;
    }
    setReady(true);
  }, []);

  // 新建/编辑任务是二级页面：隐藏底部 Tab，给底部操作栏腾位置
  const isSubPage = pathname.startsWith("/dashboard/sign-tasks/create");

  if (!ready) return null;

  return (
    <DashboardDataProvider>
      <SelfUpdateProvider>
        <div className="min-h-[100dvh]">
          <main className={cn("w-full lg:pb-20", isSubPage ? "pb-6" : "pb-[calc(var(--tabbar-h)+var(--safe-b)+28px)]")}>
            {children}
          </main>
          {!isSubPage && <TabBar />}
        </div>
      </SelfUpdateProvider>
    </DashboardDataProvider>
  );
}
