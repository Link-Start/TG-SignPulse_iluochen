"use client";

import { memo, useEffect, useState } from "react";
import {
  ArrowsClockwise,
  CaretRight,
  Check,
  ExclamationMark,
  ListDashes,
  Pause,
  PencilSimple,
  SignIn,
  Trash,
} from "@phosphor-icons/react";
import type { AccountInfo, AccountLog, AccountStatusItem, RecentRun, SignTask } from "../../lib/api";
import { cn, fmt } from "../../lib/utils";
import { describeNextRun, fmtHHMM, formatTime, getTodayState, taskKey, TodayState } from "../../lib/tasks";
import { avatarColor, buildOverallPulse, buildTaskPulse, formatRate } from "../../lib/pulse";
import { Sheet } from "../ui/sheet";
import { EmptyState, Spinner } from "../ui/controls";
import { FieldRow, ListRow, ListSection, RowInput } from "../ui/list";

type T = (key: string) => string;

// ── 账号行 ─────────────────────────────────────────────────────────

export function AccountAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: avatarColor(name) }}
    >
      {initial}
    </span>
  );
}

interface AccountCardProps {
  account: AccountInfo;
  status?: AccountStatusItem;
  tasks: SignTask[];
  recent: Record<string, RecentRun[]>;
  t: T;
  onOpen: (account: AccountInfo) => void;
  onRelogin: (account: AccountInfo) => void;
}

const TASK_STATE_ICON: Record<TodayState, { className: string; icon: React.ReactNode }> = {
  success: { className: "is-up", icon: <Check size={9} weight="bold" /> },
  failed: { className: "is-down", icon: <ExclamationMark size={9} weight="bold" /> },
  paused: { className: "is-paused", icon: <Pause size={8} weight="fill" /> },
  pending: { className: "is-wait", icon: null },
  idle: { className: "is-wait", icon: null },
};

/** 账号卡：头部是账号，下面是这个账号所有任务合起来的 30 天；桌面端再列出各任务今天的情况 */
function AccountCardImpl({ account, status, tasks, recent, t, onOpen, onRelogin }: AccountCardProps) {
  const invalid = Boolean(status?.needs_relogin);
  const pulses = tasks.map((task) => buildTaskPulse(task, recent[taskKey(task)], getTodayState(task)));
  const overall = buildOverallPulse(pulses);
  const failedToday = tasks.filter((task) => getTodayState(task) === "failed").length;
  const hasRuns = overall.days.some((day) => day.up + day.down > 0);

  return (
    <article className="group-list">
      <div className="task-row">
        <div className="flex items-center gap-3">
          <AccountAvatar name={account.name} />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onOpen(account)}
              className="task-row-open block w-full truncate text-left text-[17px] font-bold leading-[22px] tracking-[-0.01em]"
            >
              {account.name}
            </button>
            <p className="num truncate text-[13.5px] leading-[18px] text-label-2">
              {[account.remark, fmt(t("account_task_count"), { count: tasks.length })].filter(Boolean).join(" · ")}
            </p>
          </div>
          {invalid ? (
            <span className="chip chip-warn">
              <i aria-hidden />
              {t("needs_relogin")}
            </span>
          ) : failedToday > 0 ? (
            <span className="chip chip-bad num">
              <i aria-hidden />
              {fmt(t("account_failed_count"), { count: failedToday })}
            </span>
          ) : (
            <span className="chip chip-ok">
              <i aria-hidden />
              {t("account_ok")}
            </span>
          )}
        </div>

        {tasks.length > 0 ? (
          <div
            role="img"
            aria-label={`${t("pulse_rate_label")} ${formatRate(overall.rate)}`}
            className="daybars mt-3.5 h-6"
          >
            {overall.days.map((day, index) => (
              <i key={index} className={cn(day.down > 0 ? "is-down" : day.up > 0 ? "" : "is-hole")} />
            ))}
          </div>
        ) : null}

        <div className="mt-2.5 flex min-h-[32px] items-center justify-between gap-2.5">
          <span className="num min-w-0 truncate text-[13px] text-label-2">
            {tasks.length === 0
              ? t("account_no_tasks")
              : hasRuns
                ? fmt(t("pulse_caption"), { rate: formatRate(overall.rate) })
                : t("account_no_runs")}
          </span>
          {invalid ? (
            <button type="button" onClick={() => onRelogin(account)} className="btn btn-sm btn-primary relative z-[1]">
              {t("relogin_account")}
            </button>
          ) : (
            <CaretRight size={14} weight="bold" className="row-chevron" aria-hidden />
          )}
        </div>

        {tasks.length > 0 ? (
          <ul aria-label={t("tab_tasks")} className="mt-2 hidden border-t border-separator pt-1.5 lg:block">
            {tasks.map((task) => {
              const state = getTodayState(task);
              const ran = Boolean(task.last_run) && (state === "success" || state === "failed");
              const mark = TASK_STATE_ICON[state];
              return (
                <li key={task.name} className="flex min-h-[32px] items-center gap-2.5">
                  <span className={cn("st h-4 w-4", mark.className)}>{mark.icon}</span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[14px] font-medium",
                      state === "paused" && "text-label-2"
                    )}
                  >
                    {task.name}
                  </span>
                  <span
                    className={cn(
                      "num flex-none text-[12.5px]",
                      state === "failed" ? "text-danger" : state === "success" ? "text-success" : "text-label-2"
                    )}
                  >
                    {ran
                      ? `${fmtHHMM(new Date(task.last_run!.time))} ${t(state === "success" ? "summary_success" : "summary_failed")}`
                      : describeNextRun(task, t)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

export const AccountCard = memo(AccountCardImpl);

// ── 账号详情与操作 ─────────────────────────────────────────────────────

export function AccountDetailSheet({
  account,
  status,
  taskCount,
  language,
  t,
  onClose,
  onRelogin,
  onEdit,
  onLogs,
  onDelete,
}: {
  account: AccountInfo | null;
  status?: AccountStatusItem;
  taskCount: number;
  language: string;
  t: T;
  onClose: () => void;
  onRelogin: (account: AccountInfo) => void;
  onEdit: (account: AccountInfo) => void;
  onLogs: (account: AccountInfo) => void;
  onDelete: (account: AccountInfo) => void;
}) {
  const invalid = Boolean(status?.needs_relogin);
  return (
    <Sheet open={Boolean(account)} onClose={onClose} title={account?.name} subtitle={account?.remark || undefined} size="sm">
      {account ? (
        <div className="space-y-6 pt-1">
          {invalid ? (
            <div className="rounded-group bg-warning-soft px-4 py-3">
              <p className="text-headline text-warning">{t("account_invalid_title")}</p>
              <p className="mt-1 text-subhead">{t("account_invalid_desc")}</p>
              {status?.message ? (
                <p className="mt-1.5 break-all font-mono text-caption text-label-2">{status.message}</p>
              ) : null}
              <button type="button" className="btn btn-primary mt-3 w-full" onClick={() => onRelogin(account)}>
                <SignIn size={18} weight="bold" aria-hidden />
                {t("relogin_account")}
              </button>
            </div>
          ) : null}

          <ListSection>
            <ListRow
              title={t("account_status")}
              accessory={
                <span className={cn("chip", invalid ? "chip-warn" : "chip-ok")}>
                  <i aria-hidden />
                  {invalid ? t("needs_relogin") : t("connected")}
                </span>
              }
            />
            {status?.checked_at ? (
              <ListRow
                title={t("last_checked")}
                value={<span className="num">{formatTime(status.checked_at, language, true)}</span>}
              />
            ) : null}
            <ListRow
              title={t("tab_tasks")}
              value={fmt(t("account_task_count"), { count: taskCount })}
              href={`/dashboard?account=${encodeURIComponent(account.name)}`}
              chevron
            />
            <ListRow
              title={t("field_proxy")}
              value={<span className="font-mono text-subhead">{account.proxy || t("not_set")}</span>}
            />
          </ListSection>

          <ListSection>
            {!invalid ? (
              <ListRow
                icon={<SignIn size={22} className="text-accent-text" />}
                title={t("relogin_account")}
                chevron
                onClick={() => onRelogin(account)}
              />
            ) : null}
            <ListRow
              icon={<PencilSimple size={22} className="text-accent-text" />}
              title={t("edit_account")}
              chevron
              onClick={() => onEdit(account)}
            />
            <ListRow
              icon={<ListDashes size={22} className="text-accent-text" />}
              title={t("running_logs")}
              chevron
              onClick={() => onLogs(account)}
            />
          </ListSection>

          <ListSection>
            <ListRow
              icon={<Trash size={22} className="text-danger" />}
              title={t("delete_account")}
              tone="danger"
              onClick={() => onDelete(account)}
            />
          </ListSection>
        </div>
      ) : null}
    </Sheet>
  );
}

// ── 编辑账号 ─────────────────────────────────────────────────────────

export interface EditAccountData {
  account_name: string;
  remark: string;
  proxy: string;
}

export function EditAccountSheet({
  data,
  saving,
  t,
  onClose,
  onSave,
}: {
  data: EditAccountData | null;
  saving: boolean;
  t: T;
  onClose: () => void;
  onSave: (data: EditAccountData) => void;
}) {
  const [form, setForm] = useState<EditAccountData>({ account_name: "", remark: "", proxy: "" });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  return (
    <Sheet
      open={Boolean(data)}
      onClose={onClose}
      title={t("edit_account")}
      subtitle={data?.account_name}
      size="sm"
      footer={
        <button
          type="button"
          className="btn btn-primary btn-lg w-full"
          disabled={saving}
          onClick={() => onSave(form)}
        >
          {saving ? <Spinner className="text-white" /> : null}
          {t("save")}
        </button>
      }
    >
      <form
        className="space-y-6 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!saving) onSave(form);
        }}
      >
        <ListSection>
          <ListRow title={t("session_name")} value={form.account_name} />
        </ListSection>
        <ListSection footer={t("proxy_hint")}>
          <FieldRow label={t("field_remark")} htmlFor="edit-remark">
            <RowInput
              id="edit-remark"
              type="text"
              placeholder={t("remark_placeholder")}
              value={form.remark}
              onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
            />
          </FieldRow>
          <FieldRow label={t("field_proxy")} htmlFor="edit-proxy">
            <RowInput
              id="edit-proxy"
              type="text"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="socks5://ip:port"
              value={form.proxy}
              onChange={(e) => setForm((prev) => ({ ...prev, proxy: e.target.value }))}
            />
          </FieldRow>
        </ListSection>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}

// ── 账号运行日志 ─────────────────────────────────────────────────────

export function AccountLogsSheet({
  accountName,
  logs,
  loading,
  clearing,
  language,
  t,
  onClear,
  onRefresh,
  onClose,
}: {
  accountName: string | null;
  logs: AccountLog[];
  loading: boolean;
  clearing: boolean;
  language: string;
  t: T;
  onClear: () => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const plainMessages = ["Success", "Failed", t("task_exec_success"), t("task_exec_failed")];

  return (
    <Sheet
      open={Boolean(accountName)}
      onClose={onClose}
      title={t("running_logs")}
      subtitle={
        accountName
          ? `${accountName} · ${fmt(t("logs_summary"), { count: logs.length, days: 3 })}`
          : undefined
      }
      size="md"
      tall
      headerAction={
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          aria-label={t("refresh")}
          className="icon-btn bg-fill text-label-2"
        >
          <ArrowsClockwise size={17} weight="bold" aria-hidden />
        </button>
      }
      footer={
        logs.length > 0 ? (
          <button type="button" className="btn btn-danger-tinted btn-lg w-full" onClick={onClear} disabled={clearing}>
            {clearing ? <Spinner /> : <Trash size={18} weight="bold" aria-hidden />}
            {t("clear_logs")}
          </button>
        ) : undefined
      }
    >
      {loading && logs.length === 0 ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 text-label-2" label={t("loading")} />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon={<ListDashes size={36} />} title={t("no_logs")} />
      ) : (
        <ol className="group-list">
          {logs.map((log) => (
            <li key={log.id} className="list-row flex-col items-stretch gap-1 py-3">
              <div className="flex items-center gap-2">
                <span className={cn("st h-4 w-4", log.success ? "is-up" : "is-down")} aria-hidden>
                  {log.success ? <Check size={10} weight="bold" /> : <ExclamationMark size={10} weight="bold" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-headline">{log.task_name}</span>
                <span className="flex-none text-footnote text-label-2 num">
                  {formatTime(log.created_at, language, true)}
                </span>
              </div>
              <p className={cn("pl-6 text-subhead", log.success ? "text-success" : "text-danger")}>
                {log.success ? t("task_exec_success") : t("task_exec_failed")}
              </p>
              {log.bot_message ? (
                <p className="whitespace-pre-wrap break-words pl-6 text-subhead">
                  <span className="text-label-2">{t("bot_reply")}：</span>
                  {log.bot_message}
                </p>
              ) : null}
              {log.message && !plainMessages.includes(log.message.trim()) ? (
                <pre className="log-view ml-6 mt-1 max-h-[140px] overflow-auto rounded-lg bg-fill px-3 py-2 text-label-2">
                  {log.message}
                </pre>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  );
}
