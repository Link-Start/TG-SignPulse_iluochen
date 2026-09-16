"use client";

import { memo } from "react";
import { ArrowClockwise, Check, ExclamationMark, Pause } from "@phosphor-icons/react";
import type { RecentRun, SignTask } from "../../lib/api";
import { cn } from "../../lib/utils";
import { describeNextRun, formatTime, getTodayState } from "../../lib/tasks";
import { buildTaskPulse, formatRate } from "../../lib/pulse";
import type { RunState } from "./useTaskRuns";

interface TaskRowProps {
  task: SignTask;
  recent?: RecentRun[];
  run?: RunState;
  /** 所属账号登录已失效：重试换成「重新登录」 */
  blocked?: boolean;
  language: string;
  /** 按分钟变化，用于刷新「待执行」这类随时间变化的状态 */
  clock: number;
  t: (key: string) => string;
  onOpen: (task: SignTask) => void;
  onRun: (task: SignTask) => void;
  onRelogin?: (task: SignTask) => void;
}

function TaskRowImpl({ task, recent, run, blocked, language, t, onOpen, onRun, onRelogin }: TaskRowProps) {
  const today = getTodayState(task);
  const running = Boolean(run && !run.done);
  const justFinished = Boolean(run && run.done);
  const pulse = buildTaskPulse(task, recent, today, {
    running,
    success: justFinished ? run!.success : undefined,
  });
  const todayCell = pulse.cells[pulse.cells.length - 1];

  let icon: React.ReactNode;
  let iconClass: string;
  if (running) {
    iconClass = "is-run";
    icon = null;
  } else if (todayCell.state === "down") {
    iconClass = "is-down";
    icon = <ExclamationMark size={11} weight="bold" />;
  } else if (todayCell.state === "up") {
    iconClass = "is-up";
    icon = <Check size={11} weight="bold" />;
  } else if (!task.enabled) {
    iconClass = "is-paused";
    icon = <Pause size={9} weight="fill" />;
  } else {
    iconClass = "is-wait";
    icon = null;
  }

  const failedToday = todayCell.state === "down";
  const lastMessage = task.last_run?.message?.trim();

  let status: React.ReactNode;
  let statusTone = "text-label-2";
  if (running) {
    const lastLine = run!.lines[run!.lines.length - 1];
    statusTone = "text-accent-text";
    status = (
      <span key={run!.lines.length} className={cn("ticker-line block truncate", lastLine && "font-mono text-[12.5px]")}>
        {lastLine || t("task_running")}
      </span>
    );
  } else if (justFinished) {
    if (run!.success === true) {
      statusTone = "text-success";
      status = t("run_result_success");
    } else if (run!.success === false) {
      statusTone = "text-danger";
      status = run!.error || t("run_result_failed");
    } else {
      status = run!.error || t("run_result_unknown");
    }
  } else if (today === "failed" && task.last_run) {
    statusTone = "text-danger";
    status = `${formatTime(task.last_run.time, language)} ${lastMessage || t("run_result_failed")}`;
  } else if (today === "success" && task.last_run) {
    statusTone = "text-success";
    status = `${formatTime(task.last_run.time, language)} ${lastMessage || t("run_result_success")}`;
  } else {
    status = describeNextRun(task, t);
  }

  let trailing: React.ReactNode;
  if (blocked && !running) {
    trailing = (
      <button type="button" onClick={() => onRelogin?.(task)} className="btn btn-sm btn-tinted relative z-[1]">
        {t("relogin_account")}
      </button>
    );
  } else if (failedToday && !running) {
    trailing = (
      <button
        type="button"
        onClick={() => onRun(task)}
        aria-label={`${t("retry_run")} ${task.name}`}
        className="btn btn-sm btn-tinted relative z-[1]"
      >
        <ArrowClockwise size={14} weight="bold" aria-hidden />
        {t("retry_run")}
      </button>
    );
  } else {
    trailing = <span className="flex-none text-[12px] text-label-3">{t("pulse_today")}</span>;
  }

  return (
    <div className="task-row">
      <div className="flex items-center gap-2">
        <span className={cn("st", iconClass)} aria-hidden>
          {icon}
        </span>
        <button
          type="button"
          onClick={() => onOpen(task)}
          className={cn(
            "task-row-open min-w-0 flex-1 truncate text-left text-[16px] font-semibold leading-[22px]",
            !task.enabled && !running && "text-label-2"
          )}
        >
          {task.name}
        </button>
        <span className="num flex-none font-mono text-[13px] text-label-2">
          {formatRate(pulse.rate)}
          <span className="hidden font-sans lg:inline"> · {t("pulse_days_short")}</span>
        </span>
      </div>
      <div
        role="img"
        aria-label={`${t("pulse_rate_label")} ${formatRate(pulse.rate)}`}
        className={cn("daybars mt-[11px]", !task.enabled && !running && "is-dim")}
      >
        {pulse.cells.map((cell, index) => (
          <i
            key={index}
            className={cn(
              cell.state !== "up" && `is-${cell.state}`,
              index === pulse.cells.length - 1 && justFinished && "is-settled"
            )}
          />
        ))}
      </div>
      <div className="mt-[9px] flex min-h-[28px] items-center justify-between gap-2.5">
        <span className={cn("num min-w-0 truncate text-[13.5px] leading-[18px]", statusTone)} aria-live={running ? "polite" : undefined}>
          {status}
        </span>
        {trailing}
      </div>
    </div>
  );
}

export const TaskRow = memo(TaskRowImpl);

/** 加载占位：和任务行同样的高度与结构 */
export function TaskRowSkeleton() {
  return (
    <div className="task-row" aria-hidden>
      <div className="flex items-center gap-2">
        <span className="skeleton h-[18px] w-[18px] rounded-full" />
        <span className="skeleton h-4 w-2/5" />
      </div>
      <div className="daybars mt-[11px]">
        {Array.from({ length: 30 }).map((_, index) => (
          <i key={index} className="skeleton !rounded-[3px]" />
        ))}
      </div>
      <div className="mt-[9px] flex min-h-[28px] items-center">
        <span className="skeleton h-3 w-1/2" />
      </div>
    </div>
  );
}
