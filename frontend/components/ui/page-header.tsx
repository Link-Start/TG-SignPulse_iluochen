"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react";
import type { FieldTone } from "../../lib/pulse";
import { cn } from "../../lib/utils";
import { useLanguage } from "../../context/LanguageContext";
import { useAccountAlerts } from "../app/DashboardData";
import { useNavTabs } from "../app/nav";
import { BrandMark } from "./brand";

const BAR_HEIGHT = 64;

/** 浏览器顶栏 / PWA 状态栏跟随色区颜色 */
function useFieldThemeColor(ref: React.RefObject<HTMLElement>, tone: FieldTone) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const apply = () => {
      const color = getComputedStyle(node).getPropertyValue("--field").trim();
      if (!color) return;
      document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", color));
    };
    apply();
    // 切换深浅色时 <html> 的 class 会变
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [ref, tone]);
}

function DesktopTabs() {
  const { t } = useLanguage();
  const pathname = usePathname() || "/dashboard";
  const tabs = useNavTabs(pathname);
  const alerts = useAccountAlerts();
  return (
    <nav aria-label={t("main_navigation")} className="hidden items-center gap-1 lg:flex">
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        return (
          <Link key={tab.key} href={tab.href} aria-current={tab.active ? "page" : undefined} className="field-tab">
            <TabIcon size={18} weight={tab.active ? "fill" : "bold"} aria-hidden />
            {tab.label}
            {tab.key === "accounts" && alerts > 0 ? (
              <span className="field-count num" aria-label={`${alerts}`}>
                {alerts}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * 顶部色区：颜色就是当前页面的状态。
 * 上面一条是吸顶导航（手机：品牌/返回 + 操作；桌面：品牌 + 导航 + 操作），
 * 下面是随页面滚走的内容区。
 */
export function StatusField({
  tone = "neutral",
  title,
  actions,
  back,
  children,
  heroClassName,
}: {
  tone?: FieldTone;
  /** 手机上色区滚出视口后，顶栏里显示的标题 */
  title: string;
  actions?: ReactNode;
  back?: { href: string; label: string };
  children?: ReactNode;
  heroClassName?: string;
}) {
  const barRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [raised, setRaised] = useState(false);
  useFieldThemeColor(barRef, tone);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setRaised(!entry.isIntersecting && entry.boundingClientRect.top < BAR_HEIGHT * 2),
      { rootMargin: `-${BAR_HEIGHT}px 0px 0px 0px` }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const showTitle = Boolean(back) || raised;

  return (
    <>
      <header ref={barRef} data-tone={tone} className={cn("field-bar sticky top-0 z-30 pt-safe", raised && "is-raised")}>
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-2.5 px-safe lg:h-16 lg:gap-7 lg:px-8">
          {back ? (
            <Link href={back.href} aria-label={back.label} className="field-btn -ml-1 lg:hidden">
              <CaretLeft size={18} weight="bold" aria-hidden />
            </Link>
          ) : null}
          <Link
            href="/dashboard"
            className={cn("flex min-w-0 items-center gap-2.5", back && "hidden lg:flex")}
            aria-label="TG SignPulse"
          >
            <BrandMark size={28} />
            <span className="hidden text-[16px] font-bold tracking-[-0.01em] lg:inline">TG SignPulse</span>
          </Link>
          {/* 手机：品牌名与页面标题交替 */}
          <div className="relative h-6 min-w-0 flex-1 lg:hidden">
            <span
              aria-hidden={showTitle}
              className={cn(
                "absolute inset-0 truncate text-[15px] font-semibold leading-6 transition-[opacity,transform] duration-200 ease-out",
                showTitle ? "-translate-y-1 opacity-0" : "opacity-100"
              )}
            >
              TG SignPulse
            </span>
            <span
              aria-hidden={!showTitle}
              className={cn(
                "absolute inset-0 truncate text-[17px] font-semibold leading-6 transition-[opacity,transform] duration-200 ease-out",
                showTitle ? "opacity-100" : "translate-y-1 opacity-0"
              )}
            >
              {title}
            </span>
          </div>
          <DesktopTabs />
          {actions ? <div className="flex flex-none items-center gap-2 lg:ml-auto">{actions}</div> : null}
        </div>
      </header>
      <section data-tone={tone} className="field">
        <div className={cn("mx-auto max-w-[1200px] px-safe lg:px-8", heroClassName)}>{children}</div>
        <div ref={sentinelRef} aria-hidden className="absolute inset-x-0 bottom-0 h-px" />
      </section>
    </>
  );
}

/** 一级页面：色区里放大标题 */
export function PageHeader({
  title,
  subtitle,
  actions,
  tone = "neutral",
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tone?: FieldTone;
  children?: ReactNode;
}) {
  return (
    <StatusField tone={tone} title={title} actions={actions} heroClassName="pb-12 pt-1 lg:pb-16 lg:pt-6">
      <h1 className="field-headline text-[30px] lg:text-[40px]">{title}</h1>
      {subtitle ? <div className="on-field-2 mt-2 text-[15px] leading-5 lg:text-[16px]">{subtitle}</div> : null}
      {children}
    </StatusField>
  );
}

/** 二级页面：手机上顶栏是返回 + 标题；桌面上色区里是返回链接 + 大标题 */
export function NavBar({
  title,
  backHref,
  backLabel,
  trailing,
  tone = "neutral",
}: {
  title: string;
  backHref: string;
  backLabel: string;
  trailing?: ReactNode;
  tone?: FieldTone;
}) {
  return (
    <StatusField
      tone={tone}
      title={title}
      back={{ href: backHref, label: backLabel }}
      actions={trailing}
      heroClassName="pb-4 lg:pb-16 lg:pt-4"
    >
      <Link
        href={backHref}
        className="on-field-2 -ml-1 hidden items-center gap-1 rounded-full px-1 text-[15px] font-medium hover:text-white lg:inline-flex"
      >
        <CaretLeft size={15} weight="bold" aria-hidden />
        {backLabel}
      </Link>
      <h1 className="field-headline sr-only lg:not-sr-only lg:mt-2 lg:block lg:text-[40px]">{title}</h1>
    </StatusField>
  );
}
