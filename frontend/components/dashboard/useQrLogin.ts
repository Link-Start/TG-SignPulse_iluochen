"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cancelQrLogin, getQrLoginStatus, startQrLogin, submitQrPassword } from "../../lib/api";

export type QrPhase = "idle" | "loading" | "ready" | "scanning" | "password" | "success" | "expired" | "error";

export interface QrLoginInfo {
  login_id: string;
  qr_uri: string;
  qr_image?: string | null;
  expires_at: string;
}

type ToastFn = (message: string, type?: "success" | "error" | "info") => void;

interface UseQrLoginOptions {
  token: string | null;
  /** 扫码弹窗是否可见且处于扫码模式；不可见时停止轮询 */
  active: boolean;
  proxy: string;
  /** 校验并返回规范化后的账号名，不通过返回 null（silent 时不提示） */
  validateAccountName: (silent?: boolean) => string | null;
  onAccountNameNormalized: (name: string) => void;
  /** 当前规范化后的账号名（不做校验），用于登录成功回调 */
  getAccountName: () => string;
  onSuccess: (accountName: string) => void;
  addToast: ToastFn;
  t: (key: string) => string;
  formatErrorMessage: (key: string, err?: any) => string;
}

const POLL_INTERVAL_MS = 1500;

const debugQr = (payload: Record<string, any>) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[qr-login]", payload);
  }
};

/** 扫码登录状态机：生成二维码、轮询状态、过期自动刷新、2FA 提交 */
export function useQrLogin(options: UseQrLoginOptions) {
  const { token, active } = options;
  // 回调类参数经 ref 读取最新值，避免它们的引用变化让轮询 effect 反复重启
  const optsRef = useRef(options);
  optsRef.current = options;

  const [qrLogin, setQrLogin] = useState<QrLoginInfo | null>(null);
  const [qrPhase, setQrPhase] = useState<QrPhase>("idle");
  const [qrMessage, setQrMessage] = useState("");
  const [qrCountdown, setQrCountdown] = useState(0);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrPassword, setQrPassword] = useState("");
  const [qrPasswordLoading, setQrPasswordLoading] = useState(false);

  const qrPollDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrActiveLoginIdRef = useRef<string | null>(null);
  const qrPollSeqRef = useRef(0);
  const qrToastShownRef = useRef<Record<string, { expired?: boolean; error?: boolean }>>({});
  const qrPollingActiveRef = useRef(false);
  const qrRestartingRef = useRef(false);
  const qrAutoRefreshRef = useRef(0);

  const clearQrPollingTimers = useCallback(() => {
    if (qrPollDelayRef.current) {
      clearTimeout(qrPollDelayRef.current);
      qrPollDelayRef.current = null;
    }
    qrPollingActiveRef.current = false;
  }, []);

  const setQrPhaseSafe = useCallback((next: QrPhase, reason: string, extra?: Record<string, any>) => {
    setQrPhase((prev) => {
      if (prev !== next) {
        debugQr({ login_id: qrActiveLoginIdRef.current, prev, next, reason, ...extra });
      }
      return next;
    });
  }, []);

  const toastOnce = useCallback((loginId: string, kind: "expired" | "error", message: string) => {
    if (!loginId) return;
    const shown = (qrToastShownRef.current[loginId] ||= {});
    if (shown[kind]) return;
    shown[kind] = true;
    optsRef.current.addToast(message, "error");
  }, []);

  const resetQrState = useCallback(() => {
    clearQrPollingTimers();
    qrActiveLoginIdRef.current = null;
    qrRestartingRef.current = false;
    qrAutoRefreshRef.current = 0;
    setQrLogin(null);
    setQrPhase("idle");
    setQrMessage("");
    setQrCountdown(0);
    setQrLoading(false);
    setQrPassword("");
    setQrPasswordLoading(false);
  }, [clearQrPollingTimers]);

  const performQrLoginStart = useCallback(async (start?: { autoRefresh?: boolean; silent?: boolean; reason?: string }) => {
    const opts = optsRef.current;
    if (!token) return null;
    const accountName = opts.validateAccountName(start?.silent);
    if (!accountName) return null;
    try {
      if (start?.autoRefresh) {
        qrRestartingRef.current = true;
      }
      clearQrPollingTimers();
      setQrLoading(true);
      setQrPhaseSafe("loading", start?.reason ?? "start");
      const res = await startQrLogin(token, {
        account_name: accountName,
        proxy: opts.proxy || undefined,
      });
      opts.onAccountNameNormalized(accountName);
      setQrLogin(res);
      qrActiveLoginIdRef.current = res.login_id;
      qrToastShownRef.current[res.login_id] = {};
      setQrPhaseSafe("ready", "qr_ready", { expires_at: res.expires_at });
      setQrMessage("");
      return res;
    } catch (err: any) {
      setQrPhaseSafe("error", "start_failed");
      if (!start?.silent) {
        optsRef.current.addToast(optsRef.current.formatErrorMessage("qr_create_failed", err), "error");
      }
      return null;
    } finally {
      setQrLoading(false);
      qrRestartingRef.current = false;
    }
  }, [token, clearQrPollingTimers, setQrPhaseSafe]);

  const startQrPolling = useCallback((loginId: string, reason: string = "effect"): (() => void) | undefined => {
    if (!token || !loginId || !active) return;
    if (qrPollingActiveRef.current && qrActiveLoginIdRef.current === loginId) {
      debugQr({ login_id: loginId, poll: "skip", reason });
      return;
    }

    clearQrPollingTimers();
    qrActiveLoginIdRef.current = loginId;
    qrPollingActiveRef.current = true;
    qrPollSeqRef.current += 1;
    const seq = qrPollSeqRef.current;
    let stopped = false;

    const stopPolling = () => {
      if (stopped) return;
      stopped = true;
      clearQrPollingTimers();
    };

    const isStale = () =>
      stopped || qrActiveLoginIdRef.current !== loginId || qrPollSeqRef.current !== seq;

    const shouldAutoRefresh = () => {
      const now = Date.now();
      if (now - qrAutoRefreshRef.current < 1200) return false;
      qrAutoRefreshRef.current = now;
      return true;
    };

    const poll = async () => {
      const { t, formatErrorMessage } = optsRef.current;
      try {
        if (qrRestartingRef.current) return;
        const res = await getQrLoginStatus(token, loginId);
        if (isStale()) return;

        const status = res.status;
        debugQr({ login_id: loginId, pollResult: status, message: res.message || "" });
        if (status !== "password_required") {
          setQrMessage("");
        }
        if (res.expires_at) {
          setQrLogin((prev) => (prev && prev.expires_at !== res.expires_at ? { ...prev, expires_at: res.expires_at } : prev));
        }

        if (status === "success") {
          setQrPhaseSafe("success", "poll_success", { status });
          const accountName = optsRef.current.getAccountName();
          stopPolling();
          resetQrState();
          optsRef.current.onSuccess(accountName);
          return;
        }

        if (status === "password_required") {
          setQrPhaseSafe("password", "poll_password_required", { status });
          stopPolling();
          setQrMessage(t("qr_password_required"));
          return;
        }

        if (status === "scanned_wait_confirm") {
          setQrPhaseSafe("scanning", "poll_scanned", { status });
          return;
        }

        if (status === "waiting_scan") {
          setQrPhaseSafe("ready", "poll_waiting", { status });
          return;
        }

        if (status === "expired") {
          stopPolling();
          setQrPhaseSafe("loading", "auto_refresh", { status });
          if (!shouldAutoRefresh()) return;
          const refreshed = await performQrLoginStart({ autoRefresh: true, silent: true, reason: "auto_refresh" });
          if (refreshed?.login_id) {
            startQrPollingRef.current?.(refreshed.login_id, "auto_refresh");
            return;
          }
          setQrPhaseSafe("expired", "auto_refresh_failed", { status });
          toastOnce(loginId, "expired", t("qr_expired_not_found"));
          return;
        }

        if (status === "failed") {
          setQrPhaseSafe("error", "poll_terminal", { status });
          stopPolling();
          toastOnce(loginId, "error", t("qr_login_failed"));
        }
      } catch (err: any) {
        if (isStale()) return;
        debugQr({ login_id: loginId, pollError: err?.message || String(err) });
        toastOnce(loginId, "error", formatErrorMessage("qr_status_failed", err));
      }
    };

    // 上一次请求返回后再排下一次，避免后端响应慢时请求堆积
    const tick = async () => {
      await poll();
      if (isStale() || !qrPollingActiveRef.current) return;
      qrPollDelayRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    };

    qrPollDelayRef.current = setTimeout(tick, 0);
    return stopPolling;
  }, [token, active, clearQrPollingTimers, performQrLoginStart, resetQrState, setQrPhaseSafe, toastOnce]);

  // 自动刷新二维码后需要从轮询内部重新发起轮询，经 ref 取最新函数
  const startQrPollingRef = useRef(startQrPolling);
  startQrPollingRef.current = startQrPolling;

  const startLogin = useCallback(async () => {
    const res = await performQrLoginStart();
    if (res?.login_id) {
      startQrPolling(res.login_id, "start_success");
    }
  }, [performQrLoginStart, startQrPolling]);

  const cancelLogin = useCallback(async () => {
    const loginId = qrActiveLoginIdRef.current;
    if (!token || !loginId) {
      resetQrState();
      return;
    }
    try {
      setQrLoading(true);
      await cancelQrLogin(token, loginId);
    } catch (err: any) {
      optsRef.current.addToast(optsRef.current.formatErrorMessage("cancel_failed", err), "error");
    } finally {
      setQrLoading(false);
      resetQrState();
    }
  }, [token, resetQrState]);

  // 手动提交 2FA（避免自动重试导致重复请求）
  const submitPassword = useCallback(async () => {
    const loginId = qrLogin?.login_id;
    if (!token || !loginId) return;
    const { t, addToast, formatErrorMessage } = optsRef.current;
    if (!qrPassword) {
      const msg = t("qr_password_missing");
      addToast(msg, "error");
      setQrMessage(msg);
      return;
    }
    try {
      setQrPasswordLoading(true);
      await submitQrPassword(token, { login_id: loginId, password: qrPassword });
      const accountName = optsRef.current.getAccountName();
      resetQrState();
      optsRef.current.onSuccess(accountName);
    } catch (err: any) {
      const errMsg = err?.message ? String(err.message) : "";
      const lowerMsg = errMsg.toLowerCase();
      const isPasswordError = errMsg.includes("密码错误") || errMsg.includes("两步验证") || lowerMsg.includes("2fa");
      if (isPasswordError) {
        addToast(t("qr_password_invalid"), "error");
        resetQrState();
        return;
      }
      const message = errMsg || formatErrorMessage("qr_login_failed", err);
      addToast(message, "error");
      setQrMessage(message);
    } finally {
      setQrPasswordLoading(false);
    }
  }, [token, qrLogin?.login_id, qrPassword, resetQrState]);

  // 二维码有效期倒计时，仅在等待扫码/确认时运行
  useEffect(() => {
    const expiresAt = qrLogin?.expires_at;
    if (!expiresAt || !qrActiveLoginIdRef.current || !(qrPhase === "ready" || qrPhase === "scanning")) {
      setQrCountdown(0);
      return;
    }
    const expires = new Date(expiresAt).getTime();
    const update = () => setQrCountdown(Math.max(0, Math.floor((expires - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [qrLogin?.expires_at, qrPhase]);

  useEffect(() => {
    if (!token || !qrLogin?.login_id || !active) return;
    if (qrPhase === "success" || qrPhase === "expired" || qrPhase === "error" || qrPhase === "password") return;
    if (qrRestartingRef.current) return;
    return startQrPolling(qrLogin.login_id, "effect");
  }, [token, qrLogin?.login_id, active, qrPhase, startQrPolling]);

  // 组件卸载时停止轮询
  useEffect(() => clearQrPollingTimers, [clearQrPollingTimers]);

  return {
    qrLogin,
    qrPhase,
    qrMessage,
    qrCountdown,
    qrLoading,
    qrPassword,
    setQrPassword,
    qrPasswordLoading,
    startLogin,
    cancelLogin,
    submitPassword,
    resetQrState,
  };
}
