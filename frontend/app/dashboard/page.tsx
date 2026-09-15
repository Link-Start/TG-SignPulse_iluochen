"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "../../lib/auth";
import {
  listAccounts,
  startAccountLogin,
  updateAccount,
  verifyAccountLogin,
  deleteAccount,
  getAccountLogs,
  clearAccountLogs,
  listSignTasks,
  triggerHealthCheck,
  AccountInfo,
  AccountStatusItem,
  AccountLog,
  SignTask,
} from "../../lib/api";
import { Lightning, Plus, Gear, Spinner, Heartbeat } from "@phosphor-icons/react";
import { ToastContainer, useToast } from "../../components/ui/toast";
import { ThemeLanguageToggle } from "../../components/ThemeLanguageToggle";
import { useLanguage } from "../../context/LanguageContext";
import { AccountCard } from "../../components/dashboard/AccountCard";
import { AccountLogsDialog } from "../../components/dashboard/AccountLogsDialog";
import { AddAccountDialog, EMPTY_LOGIN_DATA, LoginFormData } from "../../components/dashboard/AddAccountDialog";
import { EditAccountData, EditAccountDialog } from "../../components/dashboard/EditAccountDialog";
import { useQrLogin } from "../../components/dashboard/useQrLogin";

const connectedStatus = (accountName: string): AccountStatusItem => ({
  account_name: accountName,
  ok: true,
  status: "connected",
  message: "",
  code: "OK",
  checked_at: new Date().toISOString(),
  needs_relogin: false,
});

const buildStatusMap = (accounts: AccountInfo[]) => {
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
      checked_at: acc.status_checked_at || undefined,
      needs_relogin: needsRelogin,
    };
  }
  return next;
};

export default function Dashboard() {
  const router = useRouter();
  const { t } = useLanguage();
  const { toasts, addToast, removeToast } = useToast();
  const [token, setLocalToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [tasks, setTasks] = useState<SignTask[]>([]);
  const [accountStatusMap, setAccountStatusMap] = useState<Record<string, AccountStatusItem>>({});
  const [loading, setLoading] = useState(false);

  // 日志弹窗
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [logsAccountName, setLogsAccountName] = useState("");
  const [accountLogs, setAccountLogs] = useState<AccountLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // 添加账号对话框
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [loginData, setLoginData] = useState<LoginFormData>({ ...EMPTY_LOGIN_DATA });
  const [reloginAccountName, setReloginAccountName] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<"phone" | "qr">("phone");

  // 编辑账号对话框
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editData, setEditData] = useState<EditAccountData>({ account_name: "", remark: "", proxy: "" });

  const [healthChecking, setHealthChecking] = useState(false);

  const formatErrorMessage = useCallback((key: string, err?: any) => {
    const base = t(key);
    const code = err?.code;
    return code ? `${base} (${code})` : base;
  }, [t]);

  const loadData = useCallback(async (tokenStr: string) => {
    try {
      setLoading(true);
      const [accountsData, tasksData] = await Promise.all([
        listAccounts(tokenStr),
        listSignTasks(tokenStr),
      ]);
      setAccounts(accountsData.accounts);
      setAccountStatusMap(buildStatusMap(accountsData.accounts));
      setTasks(tasksData);
    } catch (err: any) {
      addToast(formatErrorMessage("load_failed", err), "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, formatErrorMessage]);

  // 只在首次挂载时校验登录并加载数据
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;
  useEffect(() => {
    const tokenStr = getToken();
    if (!tokenStr) {
      window.location.replace("/");
      return;
    }
    setLocalToken(tokenStr);
    setChecking(false);
    loadDataRef.current(tokenStr);
  }, []);

  const taskCountByAccount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      counts[task.account_name] = (counts[task.account_name] || 0) + 1;
    }
    return counts;
  }, [tasks]);

  const normalizeAccountName = (name: string) => name.trim();

  const isDuplicateAccountName = useCallback((name: string, allowedSameName?: string | null) => {
    const normalized = normalizeAccountName(name).toLowerCase();
    if (!normalized) return false;
    const allow = normalizeAccountName(allowedSameName || "").toLowerCase();
    return accounts.some((acc) => {
      const current = acc.name.toLowerCase();
      if (allow && current === allow && normalized === allow) {
        return false;
      }
      return current === normalized;
    });
  }, [accounts]);

  /** 校验登录表单中的账号名，返回规范化后的名称；不通过返回 null */
  const validateLoginAccountName = (silent = false): string | null => {
    const trimmed = normalizeAccountName(loginData.account_name);
    if (!trimmed) {
      if (!silent) addToast(t("account_name_required"), "error");
      return null;
    }
    if (isDuplicateAccountName(trimmed, reloginAccountName)) {
      if (!silent) addToast(t("account_name_duplicate"), "error");
      return null;
    }
    return trimmed;
  };

  const updateLoginData = useCallback((patch: Partial<LoginFormData>) => {
    setLoginData((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleLoginSuccess = (accountName: string) => {
    addToast(t("login_success"), "success");
    if (accountName) {
      setAccountStatusMap((prev) => ({ ...prev, [accountName]: connectedStatus(accountName) }));
    }
    setReloginAccountName(null);
    setLoginData({ ...EMPTY_LOGIN_DATA });
    setShowAddDialog(false);
    if (token) loadData(token);
  };

  const qr = useQrLogin({
    token,
    active: showAddDialog && loginMode === "qr",
    proxy: loginData.proxy,
    validateAccountName: validateLoginAccountName,
    onAccountNameNormalized: (name) => updateLoginData({ account_name: name }),
    getAccountName: () => normalizeAccountName(loginData.account_name),
    onSuccess: handleLoginSuccess,
    addToast,
    t,
    formatErrorMessage,
  });
  const { resetQrState, cancelLogin: cancelQrLogin } = qr;

  const openAddDialog = () => {
    setReloginAccountName(null);
    setLoginMode("phone");
    setLoginData({ ...EMPTY_LOGIN_DATA });
    setShowAddDialog(true);
  };

  const openReloginDialog = useCallback((acc: Pick<AccountInfo, "name" | "proxy">, showToast: boolean = true) => {
    resetQrState();
    setReloginAccountName(acc.name);
    setLoginMode("phone");
    setLoginData({
      ...EMPTY_LOGIN_DATA,
      account_name: acc.name,
      proxy: acc.proxy || "",
    });
    setShowAddDialog(true);
    if (showToast) {
      addToast(t("account_relogin_required"), "error");
    }
  }, [addToast, resetQrState, t]);

  const handleHealthCheck = async () => {
    if (!token || healthChecking) return;
    setHealthChecking(true);
    try {
      await triggerHealthCheck(token);
      addToast("巡检完成", "success");
      await loadData(token);
    } catch {
      addToast("巡检失败，请稍后重试", "error");
    } finally {
      setHealthChecking(false);
    }
  };

  const handleStartLogin = async () => {
    if (!token) return;
    const trimmedAccountName = normalizeAccountName(loginData.account_name);
    if (!trimmedAccountName || !loginData.phone_number) {
      addToast(t("account_name_phone_required"), "error");
      return;
    }
    if (isDuplicateAccountName(trimmedAccountName, reloginAccountName)) {
      addToast(t("account_name_duplicate"), "error");
      return;
    }
    try {
      setLoading(true);
      const res = await startAccountLogin(token, {
        phone_number: loginData.phone_number,
        account_name: trimmedAccountName,
        proxy: loginData.proxy || undefined,
      });
      updateLoginData({ account_name: trimmedAccountName, phone_code_hash: res.phone_code_hash });
      addToast(t("code_sent"), "success");
    } catch (err: any) {
      addToast(formatErrorMessage("send_code_failed", err), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLogin = async () => {
    if (!token) return;
    if (!loginData.phone_code) {
      addToast(t("login_code_required"), "error");
      return;
    }
    const trimmedAccountName = validateLoginAccountName();
    if (!trimmedAccountName) return;
    try {
      setLoading(true);
      await verifyAccountLogin(token, {
        account_name: trimmedAccountName,
        phone_number: loginData.phone_number,
        phone_code: loginData.phone_code,
        phone_code_hash: loginData.phone_code_hash,
        password: loginData.password || undefined,
        proxy: loginData.proxy || undefined,
      });
      handleLoginSuccess(trimmedAccountName);
    } catch (err: any) {
      addToast(formatErrorMessage("verify_failed", err), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginModeChange = (mode: "phone" | "qr") => {
    if (mode === "phone" && loginMode !== "phone" && qr.qrLogin?.login_id) {
      cancelQrLogin();
    }
    setLoginMode(mode);
  };

  const handleCloseAddDialog = () => {
    if (qr.qrLogin?.login_id) {
      cancelQrLogin();
    }
    setReloginAccountName(null);
    setLoginData({ ...EMPTY_LOGIN_DATA });
    setLoginMode("phone");
    setShowAddDialog(false);
  };

  // ── 账号卡片操作（保持引用稳定，配合 AccountCard 的 memo） ──

  const handleAccountCardClick = useCallback((acc: AccountInfo) => {
    const statusInfo = accountStatusMap[acc.name];
    const needsRelogin = Boolean(statusInfo?.needs_relogin || acc.needs_relogin);
    const status = statusInfo?.status || acc.status;
    if (needsRelogin || status === "invalid") {
      openReloginDialog(acc);
      return;
    }
    router.push(`/dashboard/sign-tasks`);
  }, [accountStatusMap, openReloginDialog, router]);

  const handleDeleteAccount = useCallback(async (name: string) => {
    if (!token) return;
    if (!confirm(t("confirm_delete_account").replace("{name}", name))) return;
    try {
      setLoading(true);
      await deleteAccount(token, name);
      addToast(t("account_deleted"), "success");
      loadData(token);
    } catch (err: any) {
      addToast(formatErrorMessage("delete_failed", err), "error");
    } finally {
      setLoading(false);
    }
  }, [token, t, addToast, loadData, formatErrorMessage]);

  const handleEditAccount = useCallback((acc: AccountInfo) => {
    setEditData({
      account_name: acc.name,
      remark: acc.remark || "",
      proxy: acc.proxy || "",
    });
    setShowEditDialog(true);
  }, []);

  const handleShowLogs = useCallback(async (name: string) => {
    if (!token) return;
    setLogsAccountName(name);
    setShowLogsDialog(true);
    setLogsLoading(true);
    try {
      const logs = await getAccountLogs(token, name, 100);
      setAccountLogs(logs);
    } catch (err: any) {
      addToast(formatErrorMessage("logs_fetch_failed", err), "error");
    } finally {
      setLogsLoading(false);
    }
  }, [token, addToast, formatErrorMessage]);

  const handleSaveEdit = async () => {
    if (!token || !editData.account_name) return;
    try {
      setLoading(true);
      await updateAccount(token, editData.account_name, {
        remark: editData.remark || "",
        proxy: editData.proxy || "",
      });
      addToast(t("save_changes"), "success");
      setShowEditDialog(false);
      loadData(token);
    } catch (err: any) {
      addToast(formatErrorMessage("save_failed", err), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!token || !logsAccountName) return;
    if (!confirm(t("clear_logs_confirm").replace("{name}", logsAccountName))) return;
    try {
      setLoading(true);
      await clearAccountLogs(token, logsAccountName);
      addToast(t("clear_logs_success"), "success");
      setLogsLoading(true);
      const logs = await getAccountLogs(token, logsAccountName, 100);
      setAccountLogs(logs);
    } catch (err: any) {
      addToast(formatErrorMessage("clear_logs_failed", err), "error");
    } finally {
      setLogsLoading(false);
      setLoading(false);
    }
  };

  if (!token || checking) {
    return null;
  }

  return (
    <div id="dashboard-view" className="w-full h-full flex flex-col">
      <nav className="navbar">
        <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Lightning weight="fill" style={{ fontSize: '28px', color: '#fcd34d' }} />
          <span className="nav-title font-bold tracking-tight text-lg">TG SignPulse</span>
        </div>
        <div className="top-right-actions">
          <ThemeLanguageToggle />
          <button
            className="action-btn"
            title="立即巡检所有账号"
            onClick={handleHealthCheck}
            disabled={healthChecking}
          >
            {healthChecking ? <Spinner className="animate-spin" /> : <Heartbeat weight="bold" />}
          </button>
          <Link href="/dashboard/settings" title={t("sidebar_settings")} className="action-btn">
            <Gear weight="bold" />
          </Link>
        </div>
      </nav>

      <main className="main-content">
        {loading && accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-main/30">
            <Spinner className="animate-spin mb-4" size={32} />
            <p>{t("loading")}</p>
          </div>
        ) : (
          <div className="card-grid">
            {accounts.map((acc) => (
              <AccountCard
                key={acc.name}
                account={acc}
                statusInfo={accountStatusMap[acc.name]}
                taskCount={taskCountByAccount[acc.name] || 0}
                t={t}
                onOpen={handleAccountCardClick}
                onShowLogs={handleShowLogs}
                onEdit={handleEditAccount}
                onDelete={handleDeleteAccount}
              />
            ))}

            {/* 添加新账号卡片 */}
            <div
              className="card card-add !h-44"
              onClick={openAddDialog}
            >
              <div className="add-icon-circle !w-10 !h-10">
                <Plus weight="bold" size={20} />
              </div>
              <span className="text-xs font-bold" style={{ color: 'var(--text-sub)' }}>{t("add_account")}</span>
            </div>
          </div>
        )}
      </main>

      {showAddDialog && (
        <AddAccountDialog
          isRelogin={Boolean(reloginAccountName)}
          loginMode={loginMode}
          loginData={loginData}
          loading={loading}
          qr={qr}
          t={t}
          onModeChange={handleLoginModeChange}
          onLoginDataChange={updateLoginData}
          onSendCode={handleStartLogin}
          onVerify={handleVerifyLogin}
          onClose={handleCloseAddDialog}
        />
      )}

      {showEditDialog && (
        <EditAccountDialog
          data={editData}
          saving={loading}
          t={t}
          onChange={setEditData}
          onSave={handleSaveEdit}
          onRelogin={() => {
            setShowEditDialog(false);
            openReloginDialog({ name: editData.account_name, proxy: editData.proxy }, false);
          }}
          onClose={() => setShowEditDialog(false)}
        />
      )}

      {showLogsDialog && (
        <AccountLogsDialog
          accountName={logsAccountName}
          logs={accountLogs}
          logsLoading={logsLoading}
          clearing={loading}
          t={t}
          onClear={handleClearLogs}
          onClose={() => setShowLogsDialog(false)}
        />
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
