"use client";

import { ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { cn, fmt } from "../../lib/utils";
import { formatRate, PulseDay } from "../../lib/pulse";

type T = (key: string) => string;

export type SummaryKey = "failed" | "pending" | "success";

/** 把模板里的 {count} 换成放大的数字 */
export function withCount(template: string, count: number): ReactNode {
  const [before, after = ""] = template.split("{count}");
  return (
    <>
      {before}
      <span className="n">{count}</span>
      {after}
    </>
  );
}

const STAT_DOT: Record<SummaryKey, string> = {
  failed: "is-down",
  pending: "is-wait",
  success: "is-up",
};

function Pulse({
  days,
  language,
  t,
  className,
}: {
  days: PulseDay[];
  language: string;
  t: T;
  className?: string;
}) {
  const dateFmt = new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" });
  return (
    <div role="list" aria-label={t("pulse_label")} className={cn("pulse", className)}>
      {days.map((day, index) => {
        const total = day.up + day.down;
        const date = dateFmt.format(day.date);
        const label =
          total === 0
            ? fmt(t("pulse_day_empty"), { date })
            : fmt(t("pulse_day_detail"), { date, up: day.up, down: day.down });
        return (
          <i
            key={index}
            role="listitem"
            aria-label={label}
            title={label}
            className={cn(total === 0 && "is-empty", index === days.length - 1 && "is-today")}
          >
            {day.down > 0 ? <b style={{ height: `${Math.max(12, (day.down / total) * 100)}%` }} /> : null}
          </i>
        );
      })}
    </div>
  );
}

export function HomeHero({
  loading,
  headline,
  overline,
  overlineExtra,
  accountFilter,
  onClearAccount,
  summary,
  filter,
  onFilter,
  showStats,
  pulse,
  language,
  t,
}: {
  loading: boolean;
  headline: ReactNode;
  overline: string;
  overlineExtra?: string;
  accountFilter: string | null;
  onClearAccount: () => void;
  summary: Record<SummaryKey, number>;
  filter: SummaryKey | "all";
  onFilter: (key: SummaryKey | "all") => void;
  showStats: boolean;
  pulse: { days: PulseDay[]; runs: number; rate: number | null } | null;
  language: string;
  t: T;
}) {
  const cells: { key: SummaryKey; label: string }[] = [
    { key: "failed", label: t("summary_failed") },
    { key: "pending", label: t("summary_pending") },
    { key: "success", label: t("summary_success") },
  ];
  const dateFmt = new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" });
  const hasPulse = Boolean(pulse && pulse.days.some((day) => day.up + day.down > 0));

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_520px] lg:items-end lg:gap-16">
      <div className="min-w-0">
        <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-2">
          <p className="on-field-2 num text-[13px] font-medium">
            {overline}
            {overlineExtra ? <span className="hidden lg:inline"> · {overlineExtra}</span> : null}
          </p>
          {accountFilter ? (
            <button
              type="button"
              onClick={onClearAccount}
              className="field-btn has-label h-7 gap-1 px-2.5 text-[13px]"
              aria-label={`${fmt(t("filter_account"), { name: accountFilter })}，${t("clear_filter")}`}
            >
              {fmt(t("filter_account"), { name: accountFilter })}
              <X size={12} weight="bold" aria-hidden />
            </button>
          ) : null}
        </div>

        {loading ? (
          <div aria-hidden className="mb-4 mt-2 h-[38px] w-3/5 rounded-lg bg-white/20 lg:mb-[22px] lg:h-[54px]" />
        ) : (
          <h1 className="field-headline num mb-4 mt-1 text-[26px] lg:mb-[22px] lg:mt-2 lg:text-[40px]">{headline}</h1>
        )}

        {showStats ? (
          <div role="group" aria-label={t("today_summary")} className="stat-group num lg:max-w-[470px]">
            {cells.map((cell) => {
              const count = summary[cell.key];
              const active = filter === cell.key;
              return (
                <button
                  key={cell.key}
                  type="button"
                  aria-pressed={active}
                  disabled={loading}
                  onClick={() => onFilter(active ? "all" : cell.key)}
                  className={cn("stat", count === 0 && "is-zero")}
                >
                  <span className="stat-value">{loading ? "–" : count}</span>
                  <span className="stat-label">
                    <i className={STAT_DOT[cell.key]} aria-hidden />
                    {cell.label}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* 手机：一条细的 30 天脉搏 */}
        {pulse && hasPulse ? (
          <div className="mt-4 lg:hidden">
            <Pulse days={pulse.days} language={language} t={t} className="h-[30px]" />
            <div className="on-field-2 num mt-1.5 flex justify-between text-[11.5px]">
              <span>{fmt(t("pulse_caption"), { rate: formatRate(pulse.rate) })}</span>
              <span>{t("pulse_today")}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* 桌面：右侧大号脉搏 */}
      {pulse && hasPulse ? (
        <div className="hidden min-w-0 lg:block">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <span className="num text-[28px] font-bold leading-none tracking-[-0.02em]">{formatRate(pulse.rate)}</span>
            <span className="on-field-2 num text-[13px]">{fmt(t("pulse_rate_title"), { count: pulse.runs })}</span>
          </div>
          <Pulse days={pulse.days} language={language} t={t} className="h-[92px]" />
          <div className="on-field-2 num mt-2 flex justify-between text-[11.5px]">
            {[0, Math.floor(pulse.days.length / 2)].map((index) => (
              <span key={index}>{dateFmt.format(pulse.days[index].date)}</span>
            ))}
            <span>{t("pulse_today")}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
