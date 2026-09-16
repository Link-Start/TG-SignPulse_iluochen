"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CaretLeft,
  CheckCircle,
  ClockCounterClockwise,
  PencilSimple,
  Play,
  Terminal,
  Trash,
  XCircle,
} from "@phosphor-icons/react";
import type { RecentRun, SignTask, SignTaskHistoryItem } from "../../lib/api";
import { cn, fmt } from "../../lib/utils";
import { describeNextRun, describeSchedule, formatTime, getTodayState } from "../../lib/tasks";
import { buildTaskPulse, formatRate } from "../../lib/pulse";
import { Sheet } from "../ui/sheet";
import { EmptyState, Spinner, Switch } from "../ui/controls";
import { ListRow, ListSection } from "../ui/list";
import type { RunState } from "./useTaskRuns";

type T = (key: string) => string;

/** 等宽日志视图：带行号；贴底时新日志自动滚动到底部 */
export function LogLines({ lines, footer }: { lines: string[]; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  useLayoutEffect(() => {
    const node = ref.current?.closest(".overflow-y-auto") as HTMLElement | null;
    if (node && stickRef.current) node.scrollTop = node.scrollHeight;
  }, [lines.length]);

  useEffect(() => {
    const node = ref.current?.closest(".overflow-y-auto") as HTMLElement | null;
    if (!node) return;
    const onScroll = () => {
      stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 40;
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  const width = String(lines.length).length;

  return (
    <div ref={ref} className="group-list px-3 py-3">
      <ol className="log-view">
        {lines.map((line, index) => (
          <li key={index} className="flex gap-3">
            <span className="flex-none select-none text-right text-label-3" style={{ width: `${Math.max(2, width)}ch` }}>
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 text-label">{line}</span>
          </li>
        ))}
      </ol>
      {footer}
    </div>
  );
}

function ResultBadge({ success, t }: { success: boolean | null; t: T }) {
  if (success === null) return null;
  return (
    <span className={cn("badge", success ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
      {success ? t("success") : t("failure")}
    </span>
  );
}

// ── 任务详情与操作 ─────────────────────────────────────────────────────────

function TaskPulseCard({ task, recent, running, t }: { task: SignTask; recent?: RecentRun[]; running: boolean; t: T }) {
  const pulse = buildTaskPulse(task, recent, getTodayState(task), { running });
  return (
    <div className="group-list px-4 pb-3 pt-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="num text-[22px] font-bold leading-none tracking-[-0.02em]">{formatRate(pulse.rate)}</span>
        <span className="num text-[13px] text-label-2">{fmt(t("pulse_rate_title"), { count: pulse.runs })}</span>
      </div>
      <div
        role="img"
        aria-label={`${t("pulse_rate_label")} ${formatRate(pulse.rate)}`}
        className={cn("daybars mt-3 h-10", !task.enabled && !running && "is-dim")}
      >
        {pulse.cells.map((cell, index) => (
          <i key={index} className={cn(cell.state !== "up" && `is-${cell.state}`)} />
        ))}
      </div>
      <div className="num mt-1.5 flex justify-between text-[11.5px] text-label-3">
        <span>{fmt(t("pulse_days_ago"), { count: pulse.cells.length - 1 })}</span>
        <span>{t("pulse_today")}</span>
      </div>
    </div>
  );
}

export function TaskActionSheet({
  task,
  recent,
  running,
  toggling,
  language,
  t,
  onClose,
  onRun,
  onToggle,
  onHistory,
  onLatestLog,
  onEdit,
  onDelete,
}: {
  task: SignTask | null;
  recent?: RecentRun[];
  running: boolean;
  toggling: boolean;
  language: string;
  t: T;
  onClose: () => void;
  onRun: (task: SignTask) => void;
  onToggle: (task: SignTask) => void;
  onHistory: (task: SignTask) => void;
  onLatestLog: (task: SignTask) => void;
  onEdit: (task: SignTask) => void;
  onDelete: (task: SignTask) => void;
}) {
  return (
    <Sheet open={Boolean(task)} onClose={onClose} title={task?.name} subtitle={task?.account_name} size="sm">
      {task ? (
        <div className="space-y-6 pt-1">
          <TaskPulseCard task={task} recent={recent} running={running} t={t} />
          <ListSection
            footer={
              task.last_run && !task.last_run.success && task.last_run.message ? (
                <span className="text-danger">{task.last_run.message}</span>
              ) : undefined
            }
          >
            <ListRow
              title={t("task_status")}
              accessory={
                <Switch
                  checked={task.enabled}
                  loading={toggling}
                  label={`${task.enabled ? t("stop_task") : t("start_task")} ${task.name}`}
                  onChange={() => onToggle(task)}
                />
              }
            />
            <ListRow title={t("task_schedule")} value={<span className="num">{describeSchedule(task, t)}</span>} />
            <ListRow title={t("task_next_run")} value={<span className="num">{describeNextRun(task, t)}</span>} />
            <ListRow
              title={t("task_last_run")}
              value={
                task.last_run ? (
                  <span className={cn("num", task.last_run.success ? "text-success" : "text-danger")}>
                    {formatTime(task.last_run.time, language, true)} {task.last_run.success ? t("success") : t("failure")}
                  </span>
                ) : (
                  t("no_data")
                )
              }
            />
            <ListRow title={t("task_channels")} value={fmt(t("task_hits"), { count: task.chats.length })} />
          </ListSection>

          <ListSection>
            <ListRow
              icon={<Play size={20} weight="fill" className="text-accent-text" />}
              title={running ? t("task_running") : t("manual_run")}
              tone="accent"
              disabled={running}
              onClick={() => onRun(task)}
            />
            <ListRow
              icon={<ClockCounterClockwise size={22} className="text-accent-text" />}
              title={t("task_history")}
              chevron
              onClick={() => onHistory(task)}
            />
            <ListRow
              icon={<Terminal size={22} className="text-accent-text" />}
              title={t("task_logs")}
              chevron
              onClick={() => onLatestLog(task)}
            />
            <ListRow
              icon={<PencilSimple size={22} className="text-accent-text" />}
              title={t("edit_task")}
              chevron
              onClick={() => onEdit(task)}
            />
          </ListSection>

          <ListSection>
            <ListRow
              icon={<Trash size={22} className="text-danger" />}
              title={t("delete_task")}
              tone="danger"
              onClick={() => onDelete(task)}
            />
          </ListSection>
        </div>
      ) : null}
    </Sheet>
  );
}

// ── 实时运行日志 ─────────────────────────────────────────────────────────

export function RunLogSheet({ run, t, onClose }: { run: RunState | null; t: T; onClose: () => void }) {
  const status = !run ? null : !run.done ? (
    <span className="inline-flex items-center gap-1.5 text-accent-text">
      <Spinner className="h-3 w-3 border-[1.5px]" />
      {t("task_running")}
    </span>
  ) : run.success === true ? (
    <span className="text-success">{t("run_result_success")}</span>
  ) : run.success === false ? (
    <span className="text-danger">{t("run_result_failed")}</span>
  ) : (
    <span>{t("run_result_unknown")}</span>
  );

  return (
    <Sheet
      open={Boolean(run)}
      onClose={onClose}
      title={run ? fmt(t("task_run_logs_title"), { name: run.name }) : ""}
      subtitle={status}
      size="lg"
      tall
    >
      {run ? (
        run.lines.length === 0 ? (
          <EmptyState
            icon={run.done ? <Terminal size={36} /> : <Spinner className="h-7 w-7 text-label-2" />}
            title={run.done ? t("task_logs_empty") : t("logs_waiting")}
            description={run.error}
          />
        ) : (
          <LogLines
            lines={run.lines}
            footer={
              run.done && run.error ? (
                <p className="mt-3 border-t border-separator pt-3 text-footnote text-danger">{run.error}</p>
              ) : null
            }
          />
        )
      ) : null}
    </Sheet>
  );
}

// ── 执行历史（点一条看这次的完整日志） ─────────────────────────────────────

function HistoryDetail({ item, t }: { item: SignTaskHistoryItem; t: T }) {
  if (item.flow_logs && item.flow_logs.length > 0) {
    return (
      <LogLines
        lines={item.flow_logs}
        footer={
          item.flow_truncated ? (
            <p className="mt-3 border-t border-separator pt-3 text-footnote text-warning">
              {fmt(t("task_history_truncated"), { count: item.flow_line_count || 0 })}
            </p>
          ) : null
        }
      />
    );
  }
  return (
    <div className="group-list px-4 py-3">
      <p className="log-view text-label">{item.message || t("task_history_no_flow")}</p>
    </div>
  );
}

export function TaskHistorySheet({
  task,
  mode,
  items,
  loading,
  language,
  t,
  onClose,
}: {
  task: SignTask | null;
  /** history：列表，可点进单条；latest：直接展示最近一次 */
  mode: "history" | "latest";
  items: SignTaskHistoryItem[];
  loading: boolean;
  language: string;
  t: T;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<SignTaskHistoryItem | null>(null);

  useEffect(() => {
    if (!task) setSelected(null);
  }, [task]);

  const detail = mode === "latest" ? items[0] || null : selected;
  const showingDetail = Boolean(detail);

  const title = task
    ? mode === "latest"
      ? fmt(t("task_logs_title"), { name: task.name })
      : fmt(t("task_history_title"), { name: task.name })
    : "";

  const subtitle = detail ? (
    <span className="inline-flex items-center gap-2 num">
      {formatTime(detail.time, language, true)}
      <ResultBadge success={detail.success} t={t} />
    </span>
  ) : mode === "history" && items.length > 0 ? (
    t("task_history_hint")
  ) : undefined;

  return (
    <Sheet
      open={Boolean(task)}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size={showingDetail ? "lg" : "md"}
      tall={showingDetail || mode === "latest"}
      headerAction={
        mode === "history" && selected ? (
          <button type="button" onClick={() => setSelected(null)} className="btn btn-sm btn-gray gap-0.5 pl-2.5">
            <CaretLeft size={14} weight="bold" aria-hidden />
            {t("task_history")}
          </button>
        ) : undefined
      }
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 text-label-2" label={t("loading")} />
        </div>
      ) : detail ? (
        <HistoryDetail item={detail} t={t} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ClockCounterClockwise size={36} />}
          title={mode === "latest" ? t("task_logs_empty") : t("task_history_empty")}
        />
      ) : (
        <ListSection>
          {items.map((item, index) => (
            <ListRow
              key={`${item.time}-${index}`}
              icon={
                item.success ? (
                  <CheckCircle size={22} weight="fill" className="text-success-dot" />
                ) : (
                  <XCircle size={22} weight="fill" className="text-danger-dot" />
                )
              }
              title={<span className="num">{formatTime(item.time, language, true)}</span>}
              subtitle={item.message ? <span className="line-clamp-1">{item.message}</span> : undefined}
              value={item.success ? t("success") : t("failure")}
              chevron
              onClick={() => setSelected(item)}
            />
          ))}
        </ListSection>
      )}
    </Sheet>
  );
}
