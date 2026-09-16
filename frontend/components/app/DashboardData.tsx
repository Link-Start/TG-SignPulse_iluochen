"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getToken } from "../../lib/auth";
import {
  getRecentRuns,
  listAccounts,
  listSignTasks,
  AccountInfo,
  AccountStatusItem,
  RecentRun,
  SignTask,
} from "../../lib/api";
import { buildStatusMap, connectedStatus, formatError, taskKey } from "../../lib/tasks";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../ui/toast";

type ReloadFn = (options?: { silent?: boolean }) => Promise<void>;

interface DashboardDataValue {
  token: string | null;
  tasks: SignTask[];
  setTasks: React.Dispatch<React.SetStateAction<SignTask[]>>;
  accounts: AccountInfo[];
  /** taskKey -> 最近 30 天的执行结果 */
  recent: Record<string, RecentRun[]>;
  loading: boolean;
  loaded: boolean;
  failed: boolean;
  /** 最近一次成功加载的时间 */
  updatedAt: number | null;
  reload: ReloadFn;
  statusMap: Record<string, AccountStatusItem>;
  invalidAccounts: AccountInfo[];
  markConnected: (name: string) => void;
}

const DashboardDataContext = createContext<DashboardDataValue | undefined>(undefined);

/** 任务、账号、近期执行结果在各个 Tab 之间共享，切换 Tab 不用重新等待 */
export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { addToast } = useToast();
  const [token] = useState<string | null>(() => getToken());
  const [tasks, setTasks] = useState<SignTask[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [recent, setRecent] = useState<Record<string, RecentRun[]>>({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, AccountStatusItem>>({});

  const tRef = useRef(t);
  tRef.current = t;
  const inflight = useRef<Promise<void> | null>(null);

  const reload = useCallback<ReloadFn>(
    (options = {}) => {
      if (!token) return Promise.resolve();
      if (!options.silent) setLoading(true);
      // 多个页面/导航同时要数据时共用同一次请求
      if (inflight.current) return inflight.current;
      const job = (async () => {
        try {
          const [tasksData, accountsData, recentData] = await Promise.all([
            listSignTasks(token),
            listAccounts(token),
            // 状态条是锦上添花，历史接口失败不影响任务列表
            getRecentRuns(token).catch(() => null),
          ]);
          setTasks(tasksData);
          setAccounts(accountsData.accounts);
          if (recentData) {
            const next: Record<string, RecentRun[]> = {};
            for (const item of recentData) {
              next[taskKey({ name: item.task_name, account_name: item.account_name })] = item.runs;
            }
            setRecent(next);
          }
          setStatusOverrides({});
          setFailed(false);
          setLoaded(true);
          setUpdatedAt(Date.now());
        } catch (err: any) {
          setFailed(true);
          if (!options.silent) addToast(formatError(tRef.current, "load_failed", err), "error");
        } finally {
          setLoading(false);
          inflight.current = null;
        }
      })();
      inflight.current = job;
      return job;
    },
    [token, addToast]
  );

  const statusMap = useMemo(
    () => ({ ...buildStatusMap(accounts), ...statusOverrides }),
    [accounts, statusOverrides]
  );

  const invalidAccounts = useMemo(
    () => accounts.filter((acc) => statusMap[acc.name]?.needs_relogin),
    [accounts, statusMap]
  );

  const markConnected = useCallback((name: string) => {
    setStatusOverrides((prev) => ({ ...prev, [name]: connectedStatus(name) }));
  }, []);

  const value = useMemo<DashboardDataValue>(
    () => ({
      token,
      tasks,
      setTasks,
      accounts,
      recent,
      loading,
      loaded,
      failed,
      updatedAt,
      reload,
      statusMap,
      invalidAccounts,
      markConnected,
    }),
    [token, tasks, accounts, recent, loading, loaded, failed, updatedAt, reload, statusMap, invalidAccounts, markConnected]
  );

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

function useDashboardContext() {
  const context = useContext(DashboardDataContext);
  if (context === undefined) {
    throw new Error("useDashboardData must be used within a DashboardDataProvider");
  }
  return context;
}

/** 页面用：进入页面时刷新一次（已有数据时静默刷新） */
export function useDashboardData() {
  const context = useDashboardContext();
  const { reload } = context;
  const loadedRef = useRef(context.loaded);
  useEffect(() => {
    reload({ silent: loadedRef.current });
  }, [reload]);
  return context;
}

/** 导航用：只在还没有数据时加载，用于账号角标 */
export function useAccountAlerts() {
  const { invalidAccounts, loaded, reload } = useDashboardContext();
  useEffect(() => {
    if (!loaded) reload({ silent: true });
    // 只在挂载时检查
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return invalidAccounts.length;
}
