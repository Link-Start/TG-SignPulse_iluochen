"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getToken, logout } from "../../lib/auth";
import { runSignTask, SignTask } from "../../lib/api";
import { fmt } from "../../lib/utils";
import { formatError, taskKey } from "../../lib/tasks";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../ui/toast";

// 与后端日志缓冲上限一致，避免长任务日志无限增长导致卡顿
const MAX_RUN_LOG_LINES = 1000;
const WS_MAX_RETRIES = 5;
// 与后端 sign_tasks WS 约定的「登录失效」关闭码
const WS_CLOSE_UNAUTHORIZED = 4401;
// 执行结束后，行内结果保留的时间
const RESULT_LINGER_MS = 6000;

export interface RunState {
  name: string;
  accountName: string;
  lines: string[];
  done: boolean;
  /** null 表示结果未知（如实时连接断开） */
  success: boolean | null;
  error?: string;
}

interface SocketEntry {
  ws: WebSocket | null;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * 手动执行任务并通过 WebSocket 接收实时日志。
 * 支持多个任务同时执行；意外断线时带断点重连，服务端从断点续传。
 */
export function useTaskRuns({ token, onFinished }: { token: string | null; onFinished: () => void }) {
  const { t } = useLanguage();
  const { addToast } = useToast();
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const socketsRef = useRef(new Map<string, SocketEntry>());
  const lingerRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const viewingRef = useRef<string | null>(null);

  const latest = useRef({ t, addToast, onFinished });
  latest.current = { t, addToast, onFinished };

  const patchRun = useCallback((key: string, patch: Partial<RunState> | ((prev: RunState) => Partial<RunState>)) => {
    setRuns((prev) => {
      const current = prev[key];
      if (!current) return prev;
      const next = typeof patch === "function" ? patch(current) : patch;
      return { ...prev, [key]: { ...current, ...next } };
    });
  }, []);

  const removeRun = useCallback((key: string) => {
    setRuns((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const closeSocket = useCallback((key: string) => {
    const entry = socketsRef.current.get(key);
    if (!entry) return;
    socketsRef.current.delete(key);
    if (entry.timer) clearTimeout(entry.timer);
    if (entry.ws && entry.ws.readyState !== WebSocket.CLOSED) entry.ws.close();
  }, []);

  const scheduleClear = useCallback(
    (key: string) => {
      const existing = lingerRef.current.get(key);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        lingerRef.current.delete(key);
        // 用户正在查看这次运行的日志时保留，关闭日志后再清掉
        if (viewingRef.current !== key) removeRun(key);
      }, RESULT_LINGER_MS);
      lingerRef.current.set(key, timer);
    },
    [removeRun]
  );

  const finish = useCallback(
    (key: string, patch: Partial<RunState>) => {
      patchRun(key, { ...patch, done: true });
      scheduleClear(key);
    },
    [patchRun, scheduleClear]
  );

  useEffect(() => {
    const sockets = socketsRef.current;
    const lingers = lingerRef.current;
    return () => {
      sockets.forEach((_, key) => {
        const entry = sockets.get(key);
        if (entry?.timer) clearTimeout(entry.timer);
        if (entry?.ws && entry.ws.readyState !== WebSocket.CLOSED) entry.ws.close();
      });
      sockets.clear();
      lingers.forEach((timer) => clearTimeout(timer));
      lingers.clear();
    };
  }, []);

  const start = useCallback(
    async (task: SignTask) => {
      if (!token) return;
      const key = taskKey(task);
      const taskName = task.name;
      const accountName = task.account_name;
      const tr = latest.current.t;

      closeSocket(key);
      const linger = lingerRef.current.get(key);
      if (linger) {
        clearTimeout(linger);
        lingerRef.current.delete(key);
      }
      setRuns((prev) => ({
        ...prev,
        [key]: { name: taskName, accountName, lines: [], done: false, success: null },
      }));

      try {
        // 先启动任务（接口在任务占位后立即返回），再连 WebSocket，避免连上时任务还未开始被误判为已结束
        const result = await runSignTask(token, taskName, accountName);
        if (!result.success) {
          if (result.error && result.error.includes("运行中")) {
            latest.current.addToast(tr("task_already_running"), "info");
          } else {
            const message = result.error || tr("task_run_failed");
            latest.current.addToast(message, "error");
            finish(key, { success: false, error: message });
            return;
          }
        }

        // 开发环境：前端在 :3000，后端在 :8080；生产/Docker 同端口
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.port === "3000"
          ? window.location.hostname + ":8080"
          : window.location.host;

        // 断点信息：意外断线后带上它们重连，服务端从断点续传，日志不重复不丢失
        const resume = { runId: null as number | null, cursor: 0, monitorCursor: 0 };
        let retries = 0;
        let finished = false;
        const entry: SocketEntry = { ws: null, timer: null };
        socketsRef.current.set(key, entry);

        const connect = () => {
          const wsParams = new URLSearchParams({
            token,
            account_name: accountName,
            cursor: String(resume.cursor),
            monitor_cursor: String(resume.monitorCursor),
          });
          if (resume.runId !== null) wsParams.set("run_id", String(resume.runId));
          const wsUrl = `${protocol}//${host}/api/sign-tasks/ws/${encodeURIComponent(taskName)}?${wsParams.toString()}`;
          const ws = new WebSocket(wsUrl);
          entry.ws = ws;
          const isCurrent = () => socketsRef.current.get(key) === entry && entry.ws === ws;

          ws.onmessage = (event) => {
            if (!isCurrent()) return;
            let data: any;
            try {
              data = JSON.parse(event.data);
            } catch {
              return;
            }
            retries = 0;
            if (data.type === "logs") {
              let restarted = false;
              if (typeof data.run_id === "number") {
                // 任务重新启动过：服务端会从头推送新一次运行的日志
                restarted = resume.runId !== null && data.run_id !== resume.runId;
                resume.runId = data.run_id;
              }
              if (typeof data.cursor === "number") resume.cursor = data.cursor;
              if (typeof data.monitor_cursor === "number") resume.monitorCursor = data.monitor_cursor;
              const incoming: string[] = Array.isArray(data.data) ? data.data : [];
              patchRun(key, (prev) => {
                const merged = (restarted ? [] : prev.lines).concat(incoming);
                return { lines: merged.length > MAX_RUN_LOG_LINES ? merged.slice(-MAX_RUN_LOG_LINES) : merged };
              });
            } else if (data.type === "done") {
              finished = true;
              const { t: tt, addToast: toast, onFinished: refresh } = latest.current;
              if (data.success === true) {
                toast(fmt(tt("task_run_success"), { name: taskName }), "success");
              } else if (data.success === false) {
                toast(data.error || tt("task_run_failed"), "error");
              }
              finish(key, {
                success: typeof data.success === "boolean" ? data.success : null,
                error: data.error || undefined,
              });
              socketsRef.current.delete(key);
              ws.close();
              // 刷新列表中的「上次运行」状态
              refresh();
            }
            // type === "ping" 心跳包，忽略即可
          };

          ws.onerror = (err) => {
            console.error("WebSocket error:", err);
          };

          ws.onclose = (event) => {
            // 已被主动关闭（开始新一次运行 / 页面卸载）时不处理
            if (!isCurrent()) return;
            entry.ws = null;
            if (finished) return;
            // 登录已失效：重连没有意义，与 HTTP 401 一致回到登录页
            if (event.code === WS_CLOSE_UNAUTHORIZED) {
              socketsRef.current.delete(key);
              finish(key, { success: null });
              if (getToken() === token) logout();
              return;
            }
            // 意外断开（网络抖动 / 代理超时）：任务可能仍在运行，退避重连
            if (retries < WS_MAX_RETRIES) {
              const delay = Math.min(1000 * 2 ** retries, 8000);
              retries += 1;
              entry.timer = setTimeout(() => {
                entry.timer = null;
                if (socketsRef.current.get(key) !== entry) return;
                connect();
              }, delay);
              return;
            }
            socketsRef.current.delete(key);
            const message = latest.current.t("run_connection_lost");
            finish(key, { success: null, error: message });
            latest.current.addToast(message, "error");
          };
        };

        connect();
      } catch (err: any) {
        latest.current.addToast(formatError(latest.current.t, "task_run_failed", err), "error");
        removeRun(key);
      }
    },
    [token, closeSocket, finish, patchRun, removeRun]
  );

  /** 记录正在查看日志的运行；关闭查看时清掉已结束的运行 */
  const setViewing = useCallback(
    (key: string | null) => {
      const previous = viewingRef.current;
      viewingRef.current = key;
      if (previous && previous !== key && !lingerRef.current.has(previous)) {
        setRuns((prev) => {
          if (!prev[previous]?.done) return prev;
          const next = { ...prev };
          delete next[previous];
          return next;
        });
      }
    },
    []
  );

  return { runs, start, setViewing };
}
