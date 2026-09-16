"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { CaretRight, WarningCircle } from "@phosphor-icons/react";
import type { AccountInfo, AccountStatusItem, SignTask } from "../../lib/api";
import { cn, fmt } from "../../lib/utils";
import { fmtHHMM } from "../../lib/tasks";
import { avatarColor, UpcomingSlot } from "../../lib/pulse";

type T = (key: string) => string;

export function AccountAvatarDot({ name, size = 30 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.43), background: avatarColor(name) }}
    >
      {(Array.from(name)[0] || "?").toUpperCase()}
    </span>
  );
}

export function AccountChip({ invalid, failed, t }: { invalid: boolean; failed: number; t: T }) {
  if (invalid) {
    return (
      <span className="chip chip-warn">
        <i aria-hidden />
        {t("needs_relogin")}
      </span>
    );
  }
  if (failed > 0) {
    return (
      <span className="chip chip-bad num">
        <i aria-hidden />
        {fmt(t("account_failed_count"), { count: failed })}
      </span>
    );
  }
  return (
    <span className="chip chip-ok">
      <i aria-hidden />
      {t("account_ok")}
    </span>
  );
}

/** 失效账号提醒：浮起的卡片，右侧直接重新登录 */
export function InvalidAccountAlert({
  account,
  taskCount,
  t,
  onRelogin,
}: {
  account: AccountInfo;
  taskCount: number;
  t: T;
  onRelogin: (account: AccountInfo) => void;
}) {
  return (
    <div className="lift-card flex items-center gap-3 py-3 pl-3.5 pr-3">
      <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-warning-soft text-warning">
        <WarningCircle size={22} weight="fill" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15.5px] font-semibold leading-[21px]">
          {fmt(t("account_invalid_banner"), { name: account.name })}
        </p>
        <p className="num mt-px text-[13px] leading-[18px] text-label-2">
          {taskCount > 0 ? fmt(t("account_invalid_tasks"), { count: taskCount }) : t("account_invalid_no_tasks")}
        </p>
      </div>
      <button type="button" onClick={() => onRelogin(account)} className="btn btn-sm btn-primary">
        {t("relogin_account")}
      </button>
    </div>
  );
}

/** 一个账号一组：手机上账号标题浮在灰底上、卡片只放任务；桌面上标题收进卡片，避免压在色区边缘 */
export function AccountTaskCard({
  name,
  remark,
  taskCount,
  invalid,
  failed,
  t,
  children,
}: {
  name: string;
  remark?: string | null;
  taskCount: number;
  invalid: boolean;
  failed: number;
  t: T;
  children: ReactNode;
}) {
  const headingId = `account-${encodeURIComponent(name)}`;
  return (
    <section aria-labelledby={headingId} className="lg:group-list">
      <header className="flex min-h-[30px] items-center gap-2.5 px-1 pb-2.5 lg:px-4 lg:pb-0.5 lg:pt-4">
        <AccountAvatarDot name={name} />
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h2 id={headingId} className="truncate text-[17px] font-bold leading-[22px] tracking-[-0.01em]">
            {name}
          </h2>
          <span className="num hidden truncate text-[13.5px] text-label-3 sm:inline">
            {[remark, fmt(t("account_task_count"), { count: taskCount })].filter(Boolean).join(" · ")}
          </span>
          {remark ? <span className="truncate text-[13.5px] text-label-3 sm:hidden">{remark}</span> : null}
        </div>
        <AccountChip invalid={invalid} failed={failed} t={t} />
      </header>
      <div className="max-lg:group-list">{children}</div>
    </section>
  );
}

// ── 桌面侧栏 ─────────────────────────────────────────────────────────────

function SideCard({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="group-list">
      <h2 className="px-[18px] pb-1.5 pt-4 text-[13px] font-semibold text-label-2">{title}</h2>
      {children}
      {footer}
    </section>
  );
}

export function UpcomingCard({
  slots,
  now,
  statusMap,
  t,
}: {
  slots: UpcomingSlot[];
  now: Date;
  statusMap: Record<string, AccountStatusItem>;
  t: T;
}) {
  const inWindow = slots.filter((slot) => slot.day === "now").flatMap((slot) => slot.tasks);
  const later = slots.filter((slot) => slot.day !== "now");
  const firstTomorrow = later.findIndex((slot) => slot.day === "tomorrow");

  return (
    <SideCard title={t("upcoming_title")}>
      <ol className="timeline px-[18px] pb-3 pt-1">
        <li>
          <span className="num pt-px text-right font-mono text-[13px] text-label-2">{fmtHHMM(now)}</span>
          <span className="tl-dot">
            <i className="is-now" />
          </span>
          <div className="min-w-0">
            <p className="text-[14.5px] font-semibold leading-5 text-accent-text">{t("upcoming_now")}</p>
            {inWindow.length > 0 ? (
              <p className="mt-px truncate text-[12.5px] text-label-2">
                {fmt(t("upcoming_in_window"), { names: inWindow.map((task) => task.name).join("、") })}
              </p>
            ) : null}
          </div>
        </li>
        {later.map((slot, index) => {
          const blocked = slot.tasks.find((task) => statusMap[task.account_name]?.needs_relogin);
          const accounts = Array.from(new Set(slot.tasks.map((task) => task.account_name)));
          const detail = [accounts.join(" · "), slot.range ? `${slot.range} ${t("random_suffix")}` : null]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={`${slot.day}-${slot.time}-${slot.range || ""}`}>
              <span className="num pt-px text-right font-mono text-[13px] leading-5 text-label-2">
                {index === firstTomorrow ? (
                  <span className="block font-sans text-[11.5px] leading-4 text-label-3">{t("next_run_tomorrow")}</span>
                ) : null}
                {slot.time}
              </span>
              <span className="tl-dot">
                <i className={cn(blocked && "is-warn")} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-semibold leading-5">
                  {slot.tasks.map((task) => task.name).join(" · ")}
                </p>
                <p className={cn("num mt-px truncate text-[12.5px]", blocked ? "text-warning" : "text-label-2")}>
                  {blocked ? fmt(t("upcoming_skip_warn"), { name: blocked.account_name }) : detail}
                </p>
              </div>
            </li>
          );
        })}
        {later.length === 0 ? (
          <li>
            <span />
            <span className="tl-dot">
              <i />
            </span>
            <p className="text-[13px] leading-5 text-label-2">{t("upcoming_empty")}</p>
          </li>
        ) : null}
      </ol>
    </SideCard>
  );
}

export function AccountsCard({
  accounts,
  tasks,
  statusMap,
  failedByAccount,
  activeAccount,
  t,
  onSelect,
}: {
  accounts: AccountInfo[];
  tasks: SignTask[];
  statusMap: Record<string, AccountStatusItem>;
  failedByAccount: Map<string, number>;
  activeAccount: string | null;
  t: T;
  onSelect: (name: string | null) => void;
}) {
  return (
    <SideCard
      title={t("tab_accounts")}
      footer={
        <Link
          href="/dashboard/accounts"
          className="list-row-press flex min-h-[46px] items-center justify-between border-t border-separator px-[18px] text-[14.5px] font-medium text-accent-text"
        >
          {t("manage_accounts")}
          <CaretRight size={13} weight="bold" aria-hidden />
        </Link>
      }
    >
      <ul className="pb-1.5">
        {accounts.map((acc) => {
          const count = tasks.filter((task) => task.account_name === acc.name).length;
          const active = activeAccount === acc.name;
          return (
            <li key={acc.name}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : acc.name)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-[18px] py-2.5 text-left transition-colors duration-150",
                  active ? "bg-accent-soft" : "list-row-press"
                )}
              >
                <AccountAvatarDot name={acc.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold leading-5">{acc.name}</span>
                  <span className="num block truncate text-[12.5px] leading-[17px] text-label-2">
                    {[acc.remark, fmt(t("account_task_count"), { count })].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <AccountChip
                  invalid={Boolean(statusMap[acc.name]?.needs_relogin)}
                  failed={failedByAccount.get(acc.name) || 0}
                  t={t}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </SideCard>
  );
}
