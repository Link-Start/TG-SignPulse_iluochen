import type { AccountInfo, AccountStatusItem, SignTask } from "./api";
import { fmt } from "./utils";

// ── 下次执行时间计算 ─────────────────────────────────────────────────────────

function parseHHMM(hhmm: string): { h: number; m: number } | null {
  const parts = hhmm.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return { h, m };
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function fmtHHMM(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export type NextRunLabel = "today" | "tomorrow" | "in_window" | "paused" | "unknown";

export function getNextRunInfo(task: SignTask): {
  label: NextRunLabel;
  timeStr: string;   // 显示内容
  isExact: boolean;  // true=精确时刻  false=区间
} {
  if (!task.enabled) return { label: "paused", timeStr: "", isExact: false };

  const now = new Date();

  // ── 优先用后端 APScheduler 的精确触发时间 ──────────────────────────────
  if (task.next_run_time) {
    // range 模式：若当前处于窗口内且今日未成功执行，优先显示"正在窗口内"
    if (task.execution_mode === "range" && task.range_start && task.range_end) {
      const start = parseHHMM(task.range_start);
      const end = parseHHMM(task.range_end);
      if (start && end) {
        const todayStart = new Date(now); todayStart.setHours(start.h, start.m, 0, 0);
        const todayEnd = new Date(now); todayEnd.setHours(end.h, end.m, 59, 999);
        const ranSuccessToday =
          !!task.last_run && task.last_run.success &&
          isSameDay(new Date(task.last_run.time), now);
        if (!ranSuccessToday && now >= todayStart && now <= todayEnd) {
          return { label: "in_window", timeStr: `${task.range_start}–${task.range_end}`, isExact: false };
        }
      }
    }

    const nrt = new Date(task.next_run_time);
    const label = isSameDay(nrt, now) ? "today" : "tomorrow";
    const triggerHHMM = fmtHHMM(nrt);

    if (task.execution_mode === "range" && task.range_end) {
      // 触发时间 = range_start，实际执行在窗口内随机
      return { label, timeStr: `${triggerHHMM}–${task.range_end}`, isExact: false };
    }
    // 固定 cron：触发即执行，时间精确
    return { label, timeStr: triggerHHMM, isExact: true };
  }

  // ── 后端未返回时间（如调度器未启动）时纯前端兜底 ───────────────────────
  if (task.execution_mode === "range" && task.range_start && task.range_end) {
    const start = parseHHMM(task.range_start);
    const end = parseHHMM(task.range_end);
    if (!start || !end) return { label: "unknown", timeStr: "", isExact: false };

    const rangeStr = `${task.range_start}–${task.range_end}`;
    const todayStart = new Date(now); todayStart.setHours(start.h, start.m, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(end.h, end.m, 59, 999);

    const ranSuccessToday =
      !!task.last_run && task.last_run.success &&
      isSameDay(new Date(task.last_run.time), now);

    if (ranSuccessToday) return { label: "tomorrow", timeStr: rangeStr, isExact: false };
    if (now < todayStart) return { label: "today", timeStr: rangeStr, isExact: false };
    if (now <= todayEnd) return { label: "in_window", timeStr: rangeStr, isExact: false };
    return { label: "tomorrow", timeStr: rangeStr, isExact: false };
  }

  if (task.sign_at) {
    const m = /^(\d+)\s+(\d+)\s+\*\s+\*\s+\*$/.exec(task.sign_at.trim());
    if (m) {
      const todayAt = new Date(now);
      todayAt.setHours(parseInt(m[2], 10), parseInt(m[1], 10), 0, 0);
      const target = todayAt > now ? todayAt : new Date(todayAt.getTime() + 86400_000);
      return {
        label: isSameDay(target, now) ? "today" : "tomorrow",
        timeStr: fmtHHMM(target),
        isExact: true,
      };
    }
  }

  return { label: "unknown", timeStr: "", isExact: false };
}

/** 下次执行的可读文案，如「今天 09:00–18:00 随机」「明天 08:30」 */
export function describeNextRun(task: SignTask, t: (key: string) => string) {
  const info = getNextRunInfo(task);
  if (info.label === "paused") return t("next_run_paused");
  if (info.label === "unknown") return t("next_run_none");
  const day = t(`next_run_${info.label}`);
  const random = info.isExact ? "" : ` ${t("random_suffix")}`;
  return `${day} ${info.timeStr}${random}`;
}

/** 调度方式的可读文案：「每天 07:30」「每天 09:00–18:00 随机」，其他 cron 原样显示 */
export function describeSchedule(task: SignTask, t: (key: string) => string) {
  if (task.execution_mode === "range" && task.range_start && task.range_end) {
    return fmt(t("schedule_daily_range"), { start: task.range_start, end: task.range_end });
  }
  const cron = (task.sign_at || "").trim();
  const daily = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(cron.replace(/\s+/g, " "));
  if (daily && Number(daily[1]) < 60 && Number(daily[2]) < 24) {
    const time = `${daily[2].padStart(2, "0")}:${daily[1].padStart(2, "0")}`;
    return fmt(t("schedule_daily"), { time });
  }
  return cron || "—";
}

export type TodayState = "success" | "failed" | "pending" | "paused" | "idle";

/** 任务今天的状态：今天跑过看结果，没跑过看今天是否还会执行 */
export function getTodayState(task: SignTask, now = new Date()): TodayState {
  if (task.last_run && isSameDay(new Date(task.last_run.time), now)) {
    return task.last_run.success ? "success" : "failed";
  }
  if (!task.enabled) return "paused";
  const info = getNextRunInfo(task);
  if (info.label === "today" || info.label === "in_window") return "pending";
  return "idle";
}

export const taskKey = (task: Pick<SignTask, "name" | "account_name">) =>
  `${task.account_name}::${task.name}`;

export function formatTime(value: string | number | Date, language: string, withDate = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const locale = language === "zh" ? "zh-CN" : "en-US";
  if (!withDate && isSameDay(date, new Date())) {
    return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return date.toLocaleString(locale, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ── 账号状态 ─────────────────────────────────────────────────────────────

/** 后端的 status_checked_at 是不带时区的 UTC 时间，补上 Z 再交给 Date 解析 */
const asUtc = (value?: string | null) => {
  if (!value) return undefined;
  return /(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
};

export const connectedStatus = (accountName: string): AccountStatusItem => ({
  account_name: accountName,
  ok: true,
  status: "connected",
  message: "",
  code: "OK",
  checked_at: new Date().toISOString(),
  needs_relogin: false,
});

export const buildStatusMap = (accounts: AccountInfo[]) => {
  const next: Record<string, AccountStatusItem> = {};
  for (const acc of accounts) {
    const rawStatus = acc.status || "connected";
    const needsRelogin = Boolean(acc.needs_relogin) || rawStatus === "invalid" || rawStatus === "not_found";
    next[acc.name] = {
      account_name: acc.name,
      ok: !needsRelogin,
      status: needsRelogin ? "invalid" : "connected",
      message: acc.status_message || "",
      code: acc.status_code || undefined,
      checked_at: asUtc(acc.status_checked_at),
      needs_relogin: needsRelogin,
    };
  }
  return next;
};

export function formatError(t: (key: string) => string, key: string, err?: any) {
  const base = t(key);
  const code = err?.code;
  return code ? `${base} (${code})` : base;
}
