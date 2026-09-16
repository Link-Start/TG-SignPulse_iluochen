"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowsClockwise,
  ClipboardText,
  DotsThree,
  Export,
  ListChecks,
  Plus,
  UserPlus,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  deleteSignTask,
  exportAllConfigs,
  getSignTaskHistory,
  importAllConfigs,
  setSignTaskEnabled,
  AccountInfo,
  SignTask,
  SignTaskHistoryItem,
} from "../../lib/api";
import { fmt } from "../../lib/utils";
import { fmtHHMM, formatError, getTodayState, taskKey, TodayState } from "../../lib/tasks";
import { buildOverallPulse, buildTaskPulse, FieldTone, upcomingSlots } from "../../lib/pulse";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../components/ui/toast";
import { useConfirm } from "../../components/ui/confirm";
import { StatusField } from "../../components/ui/page-header";
import { Sheet } from "../../components/ui/sheet";
import { EmptyState } from "../../components/ui/controls";
import { ListRow, ListSection } from "../../components/ui/list";
import { useDashboardData } from "../../components/app/DashboardData";
import { useTaskRuns } from "../../components/tasks/useTaskRuns";
import { TaskRow, TaskRowSkeleton } from "../../components/tasks/TaskRow";
import { HomeHero, SummaryKey, withCount } from "../../components/tasks/HomeHero";
import {
  AccountTaskCard,
  AccountsCard,
  InvalidAccountAlert,
  UpcomingCard,
} from "../../components/tasks/HomeCards";
import { RunLogSheet, TaskActionSheet, TaskHistorySheet } from "../../components/tasks/TaskSheets";
import { AccountLoginSheet, ReloginTarget } from "../../components/dashboard/AccountLoginSheet";

type SummaryFilter = SummaryKey | "all";

const editHref = (task: SignTask) =>
  `/dashboard/sign-tasks/create?edit=${encodeURIComponent(task.name)}&account=${encodeURIComponent(task.account_name)}`;

export default function TasksHomePage() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const {
    token,
    tasks,
    setTasks,
    accounts,
    recent,
    loaded,
    failed,
    updatedAt,
    reload,
    statusMap,
    invalidAccounts,
    markConnected,
  } = useDashboardData();

  const refreshSilently = useCallback(() => {
    reload({ silent: true });
  }, [reload]);
  const { runs, start, setViewing } = useTaskRuns({ token, onFinished: refreshSilently });

  const [filter, setFilter] = useState<SummaryFilter>("all");
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const [actionTaskKey, setActionTaskKey] = useState<string | null>(null);
  const [viewingRunKey, setViewingRunKey] = useState<string | null>(null);
  const [historyTask, setHistoryTask] = useState<SignTask | null>(null);
  const [historyMode, setHistoryMode] = useState<"history" | "latest">("history");
  const [historyItems, setHistoryItems] = useState<SignTaskHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [relogin, setRelogin] = useState<ReloginTarget | null>(null);

  // 从账号页跳来时按账号筛选（静态导出下不用 useSearchParams）
  useEffect(() => {
    const account = new URLSearchParams(window.location.search).get("account");
    if (account) setAccountFilter(account);
  }, []);

  const selectAccount = useCallback(
    (name: string | null) => {
      setAccountFilter(name);
      router.replace(name ? `/dashboard?account=${encodeURIComponent(name)}` : "/dashboard", { scroll: false });
    },
    [router]
  );

  // 分钟级刷新「待执行 / 下次执行」这类随时间变化的文案
  const [clock, setClock] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setClock((n) => n + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  // 回到前台时静默刷新，手机上最常见的「看一眼今天签了没有」
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") reload({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  const scopedTasks = useMemo(
    () => (accountFilter ? tasks.filter((task) => task.account_name === accountFilter) : tasks),
    [tasks, accountFilter]
  );

  const todayStates = useMemo(() => {
    const map = new Map<string, TodayState>();
    for (const task of scopedTasks) map.set(taskKey(task), getTodayState(task));
    return map;
    // clock 仅用于按分钟重新计算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedTasks, clock]);

  const summary = useMemo(() => {
    const counts: Record<SummaryKey, number> = { failed: 0, pending: 0, success: 0 };
    todayStates.forEach((state) => {
      if (state === "failed" || state === "pending" || state === "success") counts[state] += 1;
    });
    return counts;
  }, [todayStates]);

  const failedByAccount = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (getTodayState(task) === "failed") map.set(task.account_name, (map.get(task.account_name) || 0) + 1);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, clock]);

  const overallPulse = useMemo(() => {
    if (scopedTasks.length === 0) return null;
    const pulses = scopedTasks.map((task) =>
      buildTaskPulse(task, recent[taskKey(task)], todayStates.get(taskKey(task)) || "idle")
    );
    return buildOverallPulse(pulses);
  }, [scopedTasks, recent, todayStates]);

  const groups = useMemo(() => {
    const visible = scopedTasks.filter((task) => filter === "all" || todayStates.get(taskKey(task)) === filter);
    const byAccount = new Map<string, SignTask[]>();
    for (const task of visible) {
      const list = byAccount.get(task.account_name) || [];
      list.push(task);
      byAccount.set(task.account_name, list);
    }
    const order = accounts.map((acc) => acc.name);
    const names = Array.from(byAccount.keys()).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib) || a.localeCompare(b);
    });
    return names.map((name) => ({
      name,
      remark: accounts.find((acc) => acc.name === name)?.remark,
      tasks: byAccount.get(name)!,
    }));
  }, [scopedTasks, filter, todayStates, accounts]);

  const visibleInvalid = accountFilter
    ? invalidAccounts.filter((acc) => acc.name === accountFilter)
    : invalidAccounts;

  const slots = useMemo(
    () => upcomingSlots(scopedTasks, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopedTasks, clock]
  );

  const actionTask = useMemo(
    () => (actionTaskKey ? tasks.find((task) => taskKey(task) === actionTaskKey) || null : null),
    [actionTaskKey, tasks]
  );

  // ── 任务操作 ──

  const handleOpen = useCallback((task: SignTask) => setActionTaskKey(taskKey(task)), []);

  const handleRun = useCallback(
    (task: SignTask) => {
      start(task);
    },
    [start]
  );

  const handleToggle = async (task: SignTask) => {
    if (!token) return;
    const key = taskKey(task);
    const next = !task.enabled;
    setToggling(key);
    try {
      const updated = await setSignTaskEnabled(token, task.name, task.account_name, next);
      setTasks((prev) =>
        prev.map((item) =>
          taskKey(item) === key ? { ...item, ...(updated && updated.name ? updated : {}), enabled: next } : item
        )
      );
      addToast(fmt(t(next ? "task_started" : "task_stopped"), { name: task.name }), "success");
    } catch (err: any) {
      addToast(formatError(t, "task_toggle_failed", err), "error");
    } finally {
      setToggling(null);
    }
  };

  const openHistory = async (task: SignTask, mode: "history" | "latest") => {
    if (!token) return;
    setActionTaskKey(null);
    setHistoryMode(mode);
    setHistoryTask(task);
    setHistoryItems([]);
    setHistoryLoading(true);
    try {
      setHistoryItems(await getSignTaskHistory(token, task.name, task.account_name, mode === "latest" ? 1 : 30));
    } catch (err: any) {
      addToast(formatError(t, "logs_fetch_failed", err), "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRunFromSheet = (task: SignTask) => {
    setActionTaskKey(null);
    const key = taskKey(task);
    setViewingRunKey(key);
    setViewing(key);
    start(task);
  };

  const closeRunLog = () => {
    setViewingRunKey(null);
    setViewing(null);
  };

  const handleDelete = async (task: SignTask) => {
    if (!token) return;
    const ok = await confirm({
      title: fmt(t("delete_task_title"), { name: task.name }),
      message: t("delete_task_message"),
      confirmText: t("delete"),
      destructive: true,
    });
    if (!ok) return;
    setActionTaskKey(null);
    try {
      await deleteSignTask(token, task.name, task.account_name);
      setTasks((prev) => prev.filter((item) => taskKey(item) !== taskKey(task)));
      addToast(fmt(t("task_deleted"), { name: task.name }), "success");
      reload({ silent: true });
    } catch (err: any) {
      addToast(formatError(t, "delete_failed", err), "error");
    }
  };

  // ── 页面级操作 ──

  const handleExport = async () => {
    if (!token) return;
    setMoreOpen(false);
    setBusy(true);
    try {
      const configStr = await exportAllConfigs(token);
      await navigator.clipboard.writeText(configStr);
      addToast(t("export_success"), "success");
    } catch (err: any) {
      addToast(formatError(t, "export_failed", err), "error");
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!token) return;
    setMoreOpen(false);
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        addToast(t("import_empty"), "error");
        return;
      }
      setBusy(true);
      await importAllConfigs(token, text, false);
      addToast(t("import_success"), "success");
      await reload({ silent: true });
    } catch (err: any) {
      addToast(formatError(t, "import_failed", err), "error");
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = () => {
    setMoreOpen(false);
    reload();
  };

  const openRelogin = (acc: AccountInfo) => setRelogin({ name: acc.name, proxy: acc.proxy });

  const handleReloginTask = useCallback(
    (task: SignTask) => {
      const acc = accounts.find((item) => item.name === task.account_name);
      setRelogin({ name: task.account_name, proxy: acc?.proxy });
    },
    [accounts]
  );

  const handleReloginSuccess = (name: string) => {
    markConnected(name);
    setRelogin(null);
    reload({ silent: true });
  };

  // ── 色区状态 ──

  const showSkeleton = !loaded && !failed;
  const loadError = failed && !loaded;
  const noAccounts = loaded && accounts.length === 0;
  const noTasks = loaded && scopedTasks.length === 0;

  let tone: FieldTone = "neutral";
  let headline: React.ReactNode = t("tab_tasks");
  if (loadError) {
    headline = t("home_headline_error");
  } else if (noAccounts) {
    headline = t("home_headline_no_account");
  } else if (loaded && summary.failed > 0) {
    tone = "danger";
    headline = withCount(t(summary.failed === 1 ? "home_headline_failed_one" : "home_headline_failed"), summary.failed);
  } else if (loaded && visibleInvalid.length > 0) {
    tone = "warn";
    const count = visibleInvalid.length;
    headline = withCount(t(count === 1 ? "home_headline_relogin_one" : "home_headline_relogin"), count);
  } else if (noTasks) {
    headline = t("home_headline_no_task");
  } else if (loaded) {
    tone = "ok";
    headline = accountFilter ? fmt(t("home_headline_filtered"), { name: accountFilter }) : t("home_headline_ok");
  }

  const locale = language === "zh" ? "zh-CN" : "en-US";
  const now = new Date();
  const todayLabel = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", weekday: "long" }).format(now);
  const overline = updatedAt
    ? `${todayLabel} · ${fmt(t("home_updated"), { time: fmtHHMM(new Date(updatedAt)) })}`
    : todayLabel;

  const createHref = accountFilter
    ? `/dashboard/sign-tasks/create?account=${encodeURIComponent(accountFilter)}`
    : "/dashboard/sign-tasks/create";

  const headerActions = (
    <>
      <button type="button" onClick={() => setMoreOpen(true)} aria-label={t("more_actions")} className="field-btn">
        <DotsThree size={20} weight="bold" aria-hidden />
      </button>
      <Link href={createHref} aria-label={t("add_task")} className="field-btn lg:hidden">
        <Plus size={18} weight="bold" aria-hidden />
      </Link>
      <Link href={createHref} className="field-btn field-btn-solid has-label hidden lg:inline-flex">
        <Plus size={16} weight="bold" aria-hidden />
        {t("add_task")}
      </Link>
    </>
  );

  let body: React.ReactNode;
  if (showSkeleton) {
    body = (
      <div className="space-y-6 lg:space-y-5" aria-busy>
        {[2, 1].map((rows, index) => (
          <div key={index} className="lg:group-list">
            <div className="flex min-h-[30px] items-center gap-2.5 px-1 pb-2.5 lg:px-4 lg:pb-0.5 lg:pt-4">
              <span className="skeleton h-[30px] w-[30px] rounded-full" />
              <span className="skeleton h-4 w-24" />
            </div>
            <div className="max-lg:group-list">
              {Array.from({ length: rows }).map((_, row) => (
                <TaskRowSkeleton key={row} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  } else if (loadError) {
    body = (
      <EmptyState
        className="group-list"
        icon={<WarningCircle size={40} />}
        title={t("load_failed")}
        description={t("load_failed_desc")}
        action={
          <button type="button" className="btn btn-tinted" onClick={() => reload()}>
            <ArrowsClockwise size={17} weight="bold" aria-hidden />
            {t("retry")}
          </button>
        }
      />
    );
  } else if (noAccounts) {
    body = (
      <EmptyState
        className="group-list"
        icon={<UserPlus size={40} />}
        title={t("empty_no_account_title")}
        description={t("empty_no_account_desc")}
        action={
          <Link href="/dashboard/accounts?add=1" className="btn btn-primary">
            {t("add_account")}
          </Link>
        }
      />
    );
  } else if (noTasks) {
    body = (
      <EmptyState
        className="group-list"
        icon={<ListChecks size={40} />}
        title={t("empty_no_task_title")}
        description={t("empty_no_task_desc")}
        action={
          <Link href={createHref} className="btn btn-primary">
            <Plus size={16} weight="bold" aria-hidden />
            {t("add_task")}
          </Link>
        }
      />
    );
  } else if (groups.length === 0) {
    body = (
      <EmptyState
        className="group-list"
        title={t("filter_empty")}
        action={
          <button type="button" className="btn btn-tinted" onClick={() => setFilter("all")}>
            {t("show_all")}
          </button>
        }
      />
    );
  } else {
    body = (
      <div className="space-y-6 lg:space-y-5">
        {groups.map((group) => {
          const invalid = Boolean(statusMap[group.name]?.needs_relogin);
          return (
            <AccountTaskCard
              key={group.name}
              name={group.name}
              remark={group.remark}
              taskCount={tasks.filter((task) => task.account_name === group.name).length}
              invalid={invalid}
              failed={failedByAccount.get(group.name) || 0}
              t={t}
            >
              {group.tasks.map((task) => {
                const key = taskKey(task);
                return (
                  <TaskRow
                    key={key}
                    task={task}
                    recent={recent[key]}
                    run={runs[key]}
                    blocked={invalid}
                    language={language}
                    clock={clock}
                    t={t}
                    onOpen={handleOpen}
                    onRun={handleRun}
                    onRelogin={handleReloginTask}
                  />
                );
              })}
            </AccountTaskCard>
          );
        })}
      </div>
    );
  }

  const showSide = loaded && accounts.length > 0;

  return (
    <>
      <StatusField tone={tone} title={t("tab_tasks")} actions={headerActions} heroClassName="pb-5 pt-1 lg:pb-[72px] lg:pt-6">
        <HomeHero
          loading={showSkeleton}
          headline={headline}
          overline={overline}
          overlineExtra={loaded && tasks.length > 0 ? fmt(t("home_task_total"), { count: scopedTasks.length }) : undefined}
          accountFilter={accountFilter}
          onClearAccount={() => selectAccount(null)}
          summary={summary}
          filter={filter}
          onFilter={setFilter}
          showStats={showSkeleton || (loaded && scopedTasks.length > 0)}
          pulse={overallPulse}
          language={language}
          t={t}
        />
      </StatusField>

      <div className="page-body relative z-[1] pt-3.5 lg:-mt-9 lg:pt-0">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
          <div className="min-w-0 space-y-3.5 lg:space-y-5">
            {loaded && visibleInvalid.length > 0 ? (
              <div className="space-y-2.5">
                {visibleInvalid.map((acc) => (
                  <InvalidAccountAlert
                    key={acc.name}
                    account={acc}
                    taskCount={tasks.filter((task) => task.account_name === acc.name).length}
                    t={t}
                    onRelogin={openRelogin}
                  />
                ))}
              </div>
            ) : null}
            {body}
          </div>

          {showSide ? (
            <aside className="hidden space-y-4 lg:sticky lg:top-[88px] lg:block">
              {scopedTasks.length > 0 ? (
                <UpcomingCard slots={slots} now={now} statusMap={statusMap} t={t} />
              ) : null}
              <AccountsCard
                accounts={accounts}
                tasks={tasks}
                statusMap={statusMap}
                failedByAccount={failedByAccount}
                activeAccount={accountFilter}
                t={t}
                onSelect={selectAccount}
              />
            </aside>
          ) : null}
        </div>
      </div>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t("tab_tasks")} size="sm">
        <ListSection className="pt-1">
          <ListRow
            icon={<ArrowsClockwise size={22} className="text-accent-text" />}
            title={t("refresh")}
            onClick={handleRefresh}
          />
          <ListRow
            icon={<ClipboardText size={22} className="text-accent-text" />}
            title={t("import_from_clipboard")}
            subtitle={t("import_from_clipboard_desc")}
            onClick={handleImport}
            disabled={busy}
          />
          <ListRow
            icon={<Export size={22} className="text-accent-text" />}
            title={t("export_all")}
            subtitle={t("export_all_desc")}
            onClick={handleExport}
            disabled={busy}
          />
        </ListSection>
      </Sheet>

      <TaskActionSheet
        task={actionTask}
        recent={actionTask ? recent[taskKey(actionTask)] : undefined}
        running={Boolean(actionTask && runs[taskKey(actionTask)] && !runs[taskKey(actionTask)].done)}
        toggling={Boolean(actionTask && toggling === taskKey(actionTask))}
        language={language}
        t={t}
        onClose={() => setActionTaskKey(null)}
        onRun={handleRunFromSheet}
        onToggle={handleToggle}
        onHistory={(task) => openHistory(task, "history")}
        onLatestLog={(task) => openHistory(task, "latest")}
        onEdit={(task) => router.push(editHref(task))}
        onDelete={handleDelete}
      />

      <RunLogSheet run={viewingRunKey ? runs[viewingRunKey] || null : null} t={t} onClose={closeRunLog} />

      <TaskHistorySheet
        task={historyTask}
        mode={historyMode}
        items={historyItems}
        loading={historyLoading}
        language={language}
        t={t}
        onClose={() => setHistoryTask(null)}
      />

      <AccountLoginSheet
        open={Boolean(relogin)}
        relogin={relogin}
        accounts={accounts}
        token={token}
        onClose={() => setRelogin(null)}
        onSuccess={handleReloginSuccess}
      />
    </>
  );
}
