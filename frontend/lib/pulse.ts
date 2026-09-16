import type { RecentRun, SignTask } from "./api";
import { getNextRunInfo, isSameDay, TodayState } from "./tasks";

/** 状态条覆盖的天数（含今天） */
export const PULSE_DAYS = 30;

export type DayState = "up" | "down" | "hole" | "pending" | "running";

export interface DayCell {
  date: Date;
  state: DayState;
  ok: number;
  fail: number;
}

export interface TaskPulse {
  cells: DayCell[];
  /** 有执行记录的天里，最终成功的比例；没有记录时为 null */
  rate: number | null;
  runs: number;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** 最近 n 天的零点，从最早到今天 */
export function lastDays(n: number, now = new Date()): Date[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Array.from({ length: n }, (_, index) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (n - 1 - index));
    return d;
  });
}

interface TodayOverride {
  running?: boolean;
  /** 刚执行完、列表还没刷新时的结果 */
  success?: boolean | null;
}

export function buildTaskPulse(
  task: SignTask,
  runs: RecentRun[] | undefined,
  today: TodayState,
  override: TodayOverride = {},
  now = new Date()
): TaskPulse {
  const merged = runs ? [...runs] : [];
  // 列表里的 last_run 可能比批量历史更新
  if (task.last_run?.time && !merged.some((run) => run.time === task.last_run!.time)) {
    merged.push({ time: task.last_run.time, success: task.last_run.success });
  }

  const byDay = new Map<string, { ok: number; fail: number; last: RecentRun; lastAt: number }>();
  for (const run of merged) {
    const at = new Date(run.time);
    const ts = at.getTime();
    if (Number.isNaN(ts)) continue;
    const key = dayKey(at);
    const entry = byDay.get(key);
    if (!entry) {
      byDay.set(key, { ok: run.success ? 1 : 0, fail: run.success ? 0 : 1, last: run, lastAt: ts });
      continue;
    }
    if (run.success) entry.ok += 1;
    else entry.fail += 1;
    if (ts >= entry.lastAt) {
      entry.last = run;
      entry.lastAt = ts;
    }
  }

  let up = 0;
  let down = 0;
  let count = 0;
  const days = lastDays(PULSE_DAYS, now);
  const cells = days.map((date, index) => {
    const entry = byDay.get(dayKey(date));
    const isToday = index === days.length - 1;
    let state: DayState = entry ? (entry.last.success ? "up" : "down") : "hole";
    if (isToday) {
      if (override.running) state = "running";
      else if (override.success === true) state = "up";
      else if (override.success === false) state = "down";
      else if (!entry && today === "pending") state = "pending";
    }
    if (entry) count += entry.ok + entry.fail;
    if (state === "up") up += 1;
    if (state === "down") down += 1;
    return { date, state, ok: entry?.ok ?? 0, fail: entry?.fail ?? 0 };
  });

  return { cells, rate: up + down > 0 ? up / (up + down) : null, runs: count };
}

export interface PulseDay {
  date: Date;
  up: number;
  down: number;
}

/** 全站每天：最终成功与失败的任务数 */
export function buildOverallPulse(pulses: TaskPulse[], now = new Date()) {
  const days: PulseDay[] = lastDays(PULSE_DAYS, now).map((date) => ({ date, up: 0, down: 0 }));
  let runs = 0;
  for (const pulse of pulses) {
    runs += pulse.runs;
    pulse.cells.forEach((cell, index) => {
      if (cell.state === "up") days[index].up += 1;
      else if (cell.state === "down") days[index].down += 1;
    });
  }
  const up = days.reduce((sum, day) => sum + day.up, 0);
  const down = days.reduce((sum, day) => sum + day.down, 0);
  return { days, runs, rate: up + down > 0 ? up / (up + down) : null };
}

export function formatRate(rate: number | null) {
  if (rate === null) return "—";
  if (rate >= 1) return "100%";
  return `${(Math.floor(rate * 1000) / 10).toFixed(1)}%`;
}

// ── 接下来 ─────────────────────────────────────────────────────────────

export interface UpcomingSlot {
  at: number;
  day: "now" | "today" | "tomorrow";
  time: string;
  range?: string;
  tasks: SignTask[];
}

const parseStart = (timeStr: string, base: Date, tomorrow: boolean) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(timeStr);
  if (!match) return null;
  const d = new Date(base);
  if (tomorrow) d.setDate(d.getDate() + 1);
  d.setHours(parseInt(match[1], 10), parseInt(match[2], 10), 0, 0);
  return d;
};

/** 今明两天将要执行的任务，同一时刻的合并成一条 */
export function upcomingSlots(tasks: SignTask[], now = new Date(), limit = 6): UpcomingSlot[] {
  const slots = new Map<string, UpcomingSlot>();
  for (const task of tasks) {
    const info = getNextRunInfo(task);
    if (info.label === "paused" || info.label === "unknown") continue;
    const [start, end] = info.timeStr.split("–");
    let at: Date | null;
    let day: UpcomingSlot["day"];
    if (info.label === "in_window") {
      at = now;
      day = "now";
    } else {
      at = task.next_run_time ? new Date(task.next_run_time) : parseStart(start, now, info.label === "tomorrow");
      day = at && isSameDay(at, now) ? "today" : "tomorrow";
    }
    if (!at || Number.isNaN(at.getTime())) continue;
    const range = !info.isExact && end ? `${start}–${end}` : undefined;
    const key = `${day}|${start}|${range || ""}`;
    const slot = slots.get(key);
    if (slot) slot.tasks.push(task);
    else slots.set(key, { at: at.getTime(), day, time: start, range, tasks: [task] });
  }
  return Array.from(slots.values())
    .sort((a, b) => a.at - b.at)
    .slice(0, limit);
}

// ── 色区 ─────────────────────────────────────────────────────────────

export type FieldTone = "danger" | "ok" | "warn" | "neutral";

const AVATAR_COLORS = ["#2b7fc6", "#7c5cd6", "#c46f16", "#16877a", "#c24b6e", "#4f6fcf"];

export function avatarColor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
