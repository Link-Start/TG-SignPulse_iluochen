"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowsClockwise, Heartbeat, Plus, UserPlus, WarningCircle } from "@phosphor-icons/react";
import {
  clearAccountLogs,
  deleteAccount,
  getAccountLogs,
  triggerHealthCheck,
  updateAccount,
  AccountInfo,
  AccountLog,
  SignTask,
} from "../../../lib/api";
import { fmt } from "../../../lib/utils";
import { formatError } from "../../../lib/tasks";
import type { FieldTone } from "../../../lib/pulse";
import { useLanguage } from "../../../context/LanguageContext";
import { useToast } from "../../../components/ui/toast";
import { useConfirm } from "../../../components/ui/confirm";
import { PageHeader } from "../../../components/ui/page-header";
import { EmptyState, Spinner } from "../../../components/ui/controls";
import { useDashboardData } from "../../../components/app/DashboardData";
import { AccountLoginSheet, ReloginTarget } from "../../../components/dashboard/AccountLoginSheet";
import {
  AccountCard,
  AccountDetailSheet,
  AccountLogsSheet,
  EditAccountData,
  EditAccountSheet,
} from "../../../components/dashboard/AccountSheets";

const LOG_LIMIT = 100;
const EMPTY_TASKS: SignTask[] = [];

export default function AccountsPage() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const { token, tasks, accounts, recent, loaded, failed, reload, statusMap, markConnected } = useDashboardData();

  const [loginOpen, setLoginOpen] = useState(false);
  const [relogin, setRelogin] = useState<ReloginTarget | null>(null);
  const [detailName, setDetailName] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditAccountData | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  const [logsAccount, setLogsAccount] = useState<string | null>(null);
  const [logs, setLogs] = useState<AccountLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  // 首页空状态「添加账号」跳来时直接打开添加面板
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("add") === "1") {
      setRelogin(null);
      setLoginOpen(true);
      router.replace("/dashboard/accounts");
    }
  }, [router]);

  const tasksByAccount = useMemo(() => {
    const map: Record<string, SignTask[]> = {};
    for (const task of tasks) (map[task.account_name] ||= []).push(task);
    return map;
  }, [tasks]);
  const taskCount = (name: string) => tasksByAccount[name]?.length || 0;

  const sortedAccounts = useMemo(() => {
    // 失效账号排在前面，便于处理
    return [...accounts].sort((a, b) => {
      const ia = statusMap[a.name]?.needs_relogin ? 0 : 1;
      const ib = statusMap[b.name]?.needs_relogin ? 0 : 1;
      return ia - ib;
    });
  }, [accounts, statusMap]);

  const invalidCount = accounts.filter((acc) => statusMap[acc.name]?.needs_relogin).length;
  const detailAccount = detailName ? accounts.find((acc) => acc.name === detailName) || null : null;

  const openAdd = () => {
    setRelogin(null);
    setLoginOpen(true);
  };

  const openRelogin = useCallback((acc: AccountInfo) => {
    setDetailName(null);
    setRelogin({ name: acc.name, proxy: acc.proxy });
    setLoginOpen(true);
  }, []);

  const closeLogin = () => {
    setLoginOpen(false);
  };

  const handleLoginSuccess = (name: string) => {
    if (name) markConnected(name);
    setLoginOpen(false);
    reload({ silent: true });
  };

  const handleOpen = useCallback((acc: AccountInfo) => setDetailName(acc.name), []);

  const handleHealthCheck = async () => {
    if (!token || checking) return;
    setChecking(true);
    try {
      await triggerHealthCheck(token);
      addToast(t("health_check_done"), "success");
      await reload({ silent: true });
    } catch (err: any) {
      addToast(formatError(t, "health_check_failed", err), "error");
    } finally {
      setChecking(false);
    }
  };

  const handleDelete = async (acc: AccountInfo) => {
    if (!token) return;
    const count = taskCount(acc.name);
    const ok = await confirm({
      title: fmt(t("delete_account_title"), { name: acc.name }),
      message: count > 0 ? fmt(t("delete_account_message_tasks"), { count }) : t("delete_account_message"),
      confirmText: t("delete"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteAccount(token, acc.name);
      setDetailName(null);
      addToast(t("account_deleted"), "success");
      reload({ silent: true });
    } catch (err: any) {
      addToast(formatError(t, "delete_failed", err), "error");
    }
  };

  const handleEdit = (acc: AccountInfo) => {
    setDetailName(null);
    setEditData({ account_name: acc.name, remark: acc.remark || "", proxy: acc.proxy || "" });
  };

  const handleSaveEdit = async (data: EditAccountData) => {
    if (!token) return;
    setSaving(true);
    try {
      await updateAccount(token, data.account_name, {
        remark: data.remark || "",
        proxy: data.proxy || "",
      });
      addToast(t("account_saved"), "success");
      setEditData(null);
      reload({ silent: true });
    } catch (err: any) {
      addToast(formatError(t, "save_failed", err), "error");
    } finally {
      setSaving(false);
    }
  };

  const loadLogs = async (name: string) => {
    if (!token) return;
    setLogsLoading(true);
    try {
      setLogs(await getAccountLogs(token, name, LOG_LIMIT));
    } catch (err: any) {
      addToast(formatError(t, "logs_fetch_failed", err), "error");
    } finally {
      setLogsLoading(false);
    }
  };

  const handleShowLogs = (acc: AccountInfo) => {
    setDetailName(null);
    setLogs([]);
    setLogsAccount(acc.name);
    loadLogs(acc.name);
  };

  const handleClearLogs = async () => {
    if (!token || !logsAccount) return;
    const ok = await confirm({
      title: t("clear_logs"),
      message: fmt(t("clear_logs_confirm"), { name: logsAccount }),
      confirmText: t("clear_logs"),
      destructive: true,
    });
    if (!ok) return;
    setClearing(true);
    try {
      await clearAccountLogs(token, logsAccount);
      addToast(t("clear_logs_success"), "success");
      await loadLogs(logsAccount);
    } catch (err: any) {
      addToast(formatError(t, "clear_logs_failed", err), "error");
    } finally {
      setClearing(false);
    }
  };

  const headerActions = (
    <>
      <button
        type="button"
        onClick={handleHealthCheck}
        disabled={checking || accounts.length === 0}
        title={t("health_check")}
        className="field-btn has-label"
      >
        {checking ? <Spinner className="h-4 w-4 border-white/30" /> : <Heartbeat size={17} weight="bold" aria-hidden />}
        {t("health_check_short")}
      </button>
      <button type="button" onClick={openAdd} aria-label={t("add_account")} className="field-btn lg:hidden">
        <Plus size={18} weight="bold" aria-hidden />
      </button>
      <button type="button" onClick={openAdd} className="field-btn field-btn-solid has-label hidden lg:inline-flex">
        <Plus size={16} weight="bold" aria-hidden />
        {t("add_account")}
      </button>
    </>
  );

  const subtitle = loaded
    ? invalidCount > 0
      ? fmt(t("accounts_subtitle_invalid"), { count: accounts.length, invalid: invalidCount })
      : fmt(t("accounts_subtitle"), { count: accounts.length })
    : undefined;

  const tone: FieldTone = !loaded || accounts.length === 0 ? "neutral" : invalidCount > 0 ? "warn" : "ok";

  return (
    <>
      <PageHeader tone={tone} title={t("tab_accounts")} subtitle={subtitle} actions={headerActions} />

      <div className="page-body relative z-[1] -mt-6 lg:-mt-9">
        {!loaded && !failed ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy>
            {[0, 1].map((index) => (
              <div key={index} className="group-list px-4 pb-3 pt-3.5">
                <div className="flex items-center gap-3">
                  <span className="skeleton h-10 w-10 rounded-full" />
                  <span className="flex flex-1 flex-col gap-2">
                    <span className="skeleton h-4 w-2/5" />
                    <span className="skeleton h-3 w-1/4" />
                  </span>
                </div>
                <span className="skeleton mt-3.5 block h-6" />
                <span className="skeleton mt-3.5 block h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : failed && !loaded ? (
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
        ) : accounts.length === 0 ? (
          <EmptyState
            className="group-list"
            icon={<UserPlus size={40} />}
            title={t("empty_no_account_title")}
            description={t("empty_no_account_desc")}
            action={
              <button type="button" className="btn btn-primary" onClick={openAdd}>
                {t("add_account")}
              </button>
            }
          />
        ) : (
          <section>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sortedAccounts.map((acc) => (
                <AccountCard
                  key={acc.name}
                  account={acc}
                  status={statusMap[acc.name]}
                  tasks={tasksByAccount[acc.name] || EMPTY_TASKS}
                  recent={recent}
                  t={t}
                  onOpen={handleOpen}
                  onRelogin={openRelogin}
                />
              ))}
            </div>
            <p className="group-footer mt-1">{t("accounts_footer")}</p>
          </section>
        )}
      </div>

      <AccountDetailSheet
        account={detailAccount}
        status={detailAccount ? statusMap[detailAccount.name] : undefined}
        taskCount={detailAccount ? taskCount(detailAccount.name) : 0}
        language={language}
        t={t}
        onClose={() => setDetailName(null)}
        onRelogin={openRelogin}
        onEdit={handleEdit}
        onLogs={handleShowLogs}
        onDelete={handleDelete}
      />

      <EditAccountSheet data={editData} saving={saving} t={t} onClose={() => setEditData(null)} onSave={handleSaveEdit} />

      <AccountLogsSheet
        accountName={logsAccount}
        logs={logs}
        loading={logsLoading}
        clearing={clearing}
        language={language}
        t={t}
        onClear={handleClearLogs}
        onRefresh={() => logsAccount && loadLogs(logsAccount)}
        onClose={() => setLogsAccount(null)}
      />

      <AccountLoginSheet
        open={loginOpen}
        relogin={relogin}
        accounts={accounts}
        token={token}
        onClose={closeLogin}
        onSuccess={handleLoginSuccess}
      />
    </>
  );
}
