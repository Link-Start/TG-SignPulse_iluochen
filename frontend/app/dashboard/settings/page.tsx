"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  Bell,
  CloudArrowDown,
  Cpu,
  GithubLogo,
  Lock,
  ShieldCheck,
  SignOut,
  SlidersHorizontal,
  Sparkle,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { getMustChangePassword, getToken, logout, setMustChangePassword, setToken } from "../../../lib/auth";
import {
  changePassword,
  changeUsername,
  deleteAIConfig,
  disableTOTP,
  enableTOTP,
  exportAllConfigs,
  getAIConfig,
  getGlobalSettings,
  getTelegramConfig,
  getTOTPStatus,
  getVersion,
  importAllConfigs,
  resetTelegramConfig,
  saveAIConfig,
  saveGlobalSettings,
  saveTelegramConfig,
  setupTOTP,
  testAIConnection,
  AIConfig,
  GlobalSettings,
  TelegramConfig,
} from "../../../lib/api";
import { formatError } from "../../../lib/tasks";
import { useLanguage } from "../../../context/LanguageContext";
import { ThemePreference, useTheme } from "../../../context/ThemeContext";
import { useToast } from "../../../components/ui/toast";
import { useConfirm } from "../../../components/ui/confirm";
import { PageHeader } from "../../../components/ui/page-header";
import { Segmented } from "../../../components/ui/controls";
import { ListRow, ListSection } from "../../../components/ui/list";
import { cn } from "../../../lib/utils";
import { BrandMark } from "../../../components/ui/brand";
import { TelegramBotNotificationSheet } from "./TelegramBotNotificationSettings";
import { UpdateRowValue, UpdateSheet } from "./UpdateSheet";
import {
  AIForm,
  AISheet,
  BackupSheet,
  GlobalSettingsSheet,
  PasswordSheet,
  TelegramApiSheet,
  TotpSheet,
  UsernameSheet,
} from "./SettingsSheets";

const GITHUB_URL = "https://github.com/loochenx/TG-SignPulse";

type SheetKey = "username" | "password" | "totp" | "ai" | "bot" | "global" | "telegram" | "backup" | "update" | null;

/** iOS 设置风格的方块图标；绿、红、琥珀只留给状态，这里只用品牌蓝和中性灰 */
function RowIcon({ icon: IconComponent, tone = "accent" }: { icon: Icon; tone?: "accent" | "gray" }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-[8px] text-white",
        tone === "accent" ? "bg-[var(--field-neutral)]" : "bg-[var(--label-3)]"
      )}
    >
      <IconComponent size={18} weight="fill" aria-hidden />
    </span>
  );
}

const DEFAULT_GLOBAL: GlobalSettings = {
  sign_interval: null,
  log_retention_days: 7,
  data_dir: null,
  global_proxy: null,
  telegram_bot_notify_enabled: false,
  telegram_bot_login_notify_enabled: false,
  telegram_bot_task_failure_enabled: true,
  telegram_bot_token: null,
  telegram_bot_chat_id: null,
  telegram_bot_message_thread_id: null,
};

export default function SettingsPage() {
  const { t, language, setLanguage } = useLanguage();
  const { preference, setPreference } = useTheme();
  const { addToast } = useToast();
  const confirm = useConfirm();

  const [token, setLocalToken] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [busy, setBusy] = useState(false);
  const [mustChangePassword, setMustChangePasswordState] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [aiConfig, setAIConfig] = useState<AIConfig | null>(null);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL);
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig | null>(null);
  const [versionInfo, setVersionInfo] = useState<{ version: string; built_at: string } | null>(null);

  const closeSheet = () => setSheet(null);

  const loadTOTPStatus = useCallback(async (tokenStr: string) => {
    try {
      setTotpEnabled((await getTOTPStatus(tokenStr)).enabled);
    } catch {}
  }, []);

  const loadAIConfig = useCallback(async (tokenStr: string) => {
    try {
      setAIConfig(await getAIConfig(tokenStr));
    } catch {}
  }, []);

  const loadGlobalSettings = useCallback(async (tokenStr: string) => {
    try {
      setGlobalSettings(await getGlobalSettings(tokenStr));
    } catch {}
  }, []);

  const loadTelegramConfig = useCallback(async (tokenStr: string) => {
    try {
      setTelegramConfig(await getTelegramConfig(tokenStr));
    } catch {}
  }, []);

  useEffect(() => {
    const tokenStr = getToken();
    if (!tokenStr) return;
    setLocalToken(tokenStr);
    const mustChange = getMustChangePassword();
    setMustChangePasswordState(mustChange);
    // 仍在使用默认密码：直接打开改密面板
    if (mustChange) setSheet("password");
    loadTOTPStatus(tokenStr);
    loadAIConfig(tokenStr);
    loadGlobalSettings(tokenStr);
    loadTelegramConfig(tokenStr);
    getVersion().then(setVersionInfo).catch(() => {});
  }, [loadTOTPStatus, loadAIConfig, loadGlobalSettings, loadTelegramConfig]);

  const withBusy = async <R,>(fn: () => Promise<R>): Promise<R> => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  };

  // ── 账户与安全 ──

  const handleChangeUsername = (newUsername: string, password: string) =>
    withBusy(async () => {
      if (!token) return false;
      if (!newUsername || !password) {
        addToast(t("form_incomplete"), "error");
        return false;
      }
      try {
        const res = await changeUsername(token, newUsername, password);
        if (res.access_token) {
          setToken(res.access_token);
          setLocalToken(res.access_token);
        }
        addToast(t("username_changed"), "success");
        closeSheet();
        return true;
      } catch (err: any) {
        addToast(formatError(t, "change_failed", err), "error");
        return false;
      }
    });

  const handleChangePassword = (oldPassword: string, newPassword: string, confirmPassword: string) =>
    withBusy(async () => {
      if (!token) return false;
      if (!oldPassword || !newPassword) {
        addToast(t("form_incomplete"), "error");
        return false;
      }
      if (newPassword !== confirmPassword) {
        addToast(t("password_mismatch"), "error");
        return false;
      }
      try {
        await changePassword(token, oldPassword, newPassword);
        setMustChangePassword(false);
        setMustChangePasswordState(false);
        addToast(t("password_changed"), "success");
        closeSheet();
        return true;
      } catch (err: any) {
        addToast(formatError(t, "change_failed", err), "error");
        return false;
      }
    });

  const handleSetupTOTP = async () => {
    if (!token) return null;
    try {
      return (await setupTOTP(token)).secret;
    } catch (err: any) {
      addToast(formatError(t, "setup_failed", err), "error");
      return null;
    }
  };

  const handleEnableTOTP = async (code: string) => {
    if (!token) return false;
    try {
      await enableTOTP(token, code);
      setTotpEnabled(true);
      addToast(t("two_factor_enabled"), "success");
      closeSheet();
      return true;
    } catch (err: any) {
      addToast(formatError(t, "enable_failed", err), "error");
      return false;
    }
  };

  const handleDisableTOTP = async (code: string) => {
    if (!token) return false;
    try {
      await disableTOTP(token, code);
      setTotpEnabled(false);
      addToast(t("two_factor_disabled"), "success");
      closeSheet();
      return true;
    } catch (err: any) {
      addToast(formatError(t, "disable_failed", err), "error");
      return false;
    }
  };

  // ── AI ──

  const handleSaveAI = (form: AIForm) =>
    withBusy(async () => {
      if (!token) return;
      try {
        const payload: { api_key?: string; base_url?: string; model?: string } = {
          base_url: form.base_url.trim() || undefined,
          model: form.model.trim() || undefined,
        };
        const apiKey = form.api_key.trim();
        if (apiKey) payload.api_key = apiKey;
        await saveAIConfig(token, payload);
        addToast(t("ai_save_success"), "success");
        await loadAIConfig(token);
      } catch (err: any) {
        addToast(formatError(t, "save_failed", err), "error");
      }
    });

  const handleTestAI = async () => {
    if (!token) return { ok: false, message: t("test_failed") };
    try {
      const res = await testAIConnection(token);
      return res.success
        ? { ok: true, message: res.model_used ? `${t("connect_success")} · ${res.model_used}` : t("connect_success") }
        : { ok: false, message: res.message || t("connect_failed") };
    } catch (err: any) {
      return { ok: false, message: formatError(t, "test_failed", err) };
    }
  };

  const handleDeleteAI = async () => {
    if (!token) return;
    const ok = await confirm({
      title: t("delete_ai_config"),
      message: t("confirm_delete_ai"),
      confirmText: t("delete"),
      destructive: true,
    });
    if (!ok) return;
    await withBusy(async () => {
      try {
        await deleteAIConfig(token);
        setAIConfig(null);
        addToast(t("ai_delete_success"), "success");
        closeSheet();
      } catch (err: any) {
        addToast(formatError(t, "delete_failed", err), "error");
      }
    });
  };

  // ── 全局参数 / 通知 ──

  const handleSaveGlobal = (patch: GlobalSettings) =>
    withBusy(async () => {
      if (!token) return;
      const next = { ...globalSettings, ...patch };
      try {
        await saveGlobalSettings(token, next);
        setGlobalSettings(next);
        addToast(t("global_save_success"), "success");
        closeSheet();
      } catch (err: any) {
        addToast(formatError(t, "save_failed", err), "error");
      }
    });

  // ── Telegram API ──

  const handleSaveTelegram = (apiId: string, apiHash: string) =>
    withBusy(async () => {
      if (!token) return;
      if (!apiId || !apiHash) {
        addToast(t("form_incomplete"), "error");
        return;
      }
      try {
        await saveTelegramConfig(token, { api_id: apiId, api_hash: apiHash });
        addToast(t("telegram_save_success"), "success");
        await loadTelegramConfig(token);
        closeSheet();
      } catch (err: any) {
        addToast(formatError(t, "save_failed", err), "error");
      }
    });

  const handleResetTelegram = async () => {
    if (!token) return;
    const ok = await confirm({
      title: t("restore_default"),
      message: t("confirm_reset_telegram"),
      confirmText: t("restore_default"),
      destructive: true,
    });
    if (!ok) return;
    await withBusy(async () => {
      try {
        await resetTelegramConfig(token);
        addToast(t("config_reset"), "success");
        await loadTelegramConfig(token);
      } catch (err: any) {
        addToast(formatError(t, "operation_failed", err), "error");
      }
    });
  };

  // ── 备份 ──

  const handleExport = () =>
    withBusy(async () => {
      if (!token) return;
      try {
        const config = await exportAllConfigs(token);
        const blob = new Blob([config], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "tg-signer-config.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        addToast(t("export_file_success"), "success");
      } catch (err: any) {
        addToast(formatError(t, "export_failed", err), "error");
      }
    });

  const handleImport = (content: string, overwrite: boolean) =>
    withBusy(async () => {
      if (!token) return false;
      if (!content.trim()) {
        addToast(t("import_empty"), "error");
        return false;
      }
      try {
        await importAllConfigs(token, content, overwrite);
        addToast(t("import_success"), "success");
        loadAIConfig(token);
        loadGlobalSettings(token);
        loadTelegramConfig(token);
        return true;
      } catch (err: any) {
        addToast(formatError(t, "import_failed", err), "error");
        return false;
      }
    });

  const handleLogout = async () => {
    const ok = await confirm({ title: t("logout_confirm"), confirmText: t("logout"), destructive: true });
    if (ok) logout();
  };

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: "system", label: t("theme_system") },
    { value: "light", label: t("theme_light") },
    { value: "dark", label: t("theme_dark") },
  ];

  const aiSummary = aiConfig?.has_config ? aiConfig.model || t("configured") : t("not_configured");
  const botSummary = globalSettings.telegram_bot_notify_enabled ? t("status_on") : t("status_off");
  const tgSummary = telegramConfig ? (telegramConfig.is_custom ? t("tg_api_custom_short") : t("tg_api_default_short")) : "";

  return (
    <>
      <PageHeader
        tone={mustChangePassword ? "warn" : "neutral"}
        title={t("tab_settings")}
        subtitle={
          mustChangePassword
            ? t("default_password_title")
            : versionInfo
              ? <span className="num">TG SignPulse v{versionInfo.version}</span>
              : undefined
        }
      />

      <div className="page-body relative z-[1] -mt-6 grid items-start gap-4 lg:-mt-9 lg:grid-cols-2 lg:gap-6">
        <div className="space-y-4 lg:space-y-5">
          {mustChangePassword ? (
            <div className="lift-card flex items-center gap-3 py-3 pl-3.5 pr-3">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-warning-soft text-warning">
                <WarningCircle size={22} weight="fill" aria-hidden />
              </span>
              <p className="min-w-0 flex-1 text-[13.5px] leading-[19px] text-label-2">{t("default_password_warning")}</p>
              <button type="button" onClick={() => setSheet("password")} className="btn btn-sm btn-primary">
                {t("change_password")}
              </button>
            </div>
          ) : null}

          <ListSection title={t("appearance")}>
            <div className="list-row flex-col items-stretch gap-2.5 py-3">
              <span className="text-body">{t("theme")}</span>
              <Segmented value={preference} onChange={setPreference} options={themeOptions} label={t("theme")} />
            </div>
            <div className="list-row flex-col items-stretch gap-2.5 py-3">
              <span className="text-body">{t("language")}</span>
              <Segmented
                value={language}
                onChange={setLanguage}
                label={t("language")}
                options={[
                  { value: "zh", label: "简体中文" },
                  { value: "en", label: "English" },
                ]}
              />
            </div>
          </ListSection>

          <ListSection title={t("account_security")}>
            <ListRow
              icon={<RowIcon icon={UserCircle} />}
              title={t("username")}
              chevron
              onClick={() => setSheet("username")}
            />
            <ListRow
              icon={<RowIcon icon={Lock} />}
              title={t("change_password")}
              value={mustChangePassword ? <span className="text-danger">{t("needs_change")}</span> : undefined}
              chevron
              onClick={() => setSheet("password")}
            />
            <ListRow
              icon={<RowIcon icon={ShieldCheck} />}
              title={t("2fa_settings")}
              value={totpEnabled ? t("status_on") : t("status_off")}
              chevron
              onClick={() => setSheet("totp")}
            />
          </ListSection>
        </div>

        <div className="space-y-4 lg:space-y-5">
          <ListSection title={t("features")}>
            <ListRow
              icon={<RowIcon icon={Sparkle} />}
              title={t("ai_config")}
              value={aiSummary}
              chevron
              onClick={() => setSheet("ai")}
            />
            <ListRow
              icon={<RowIcon icon={Bell} />}
              title={t("telegram_bot_notify")}
              value={botSummary}
              chevron
              onClick={() => setSheet("bot")}
            />
            <ListRow
              icon={<RowIcon icon={SlidersHorizontal} tone="gray" />}
              title={t("global_settings")}
              chevron
              onClick={() => setSheet("global")}
            />
            <ListRow
              icon={<RowIcon icon={Cpu} />}
              title={t("tg_api_config")}
              value={tgSummary}
              chevron
              onClick={() => setSheet("telegram")}
            />
          </ListSection>

          <ListSection title={t("data")}>
            <ListRow
              icon={<RowIcon icon={CloudArrowDown} />}
              title={t("backup_migration")}
              chevron
              onClick={() => setSheet("backup")}
            />
          </ListSection>

          <ListSection title={t("about")}>
            <ListRow
              icon={
                <span className="rounded-[8px] bg-[var(--field-neutral)]">
                  <BrandMark size={28} className="rounded-[8px]" />
                </span>
              }
              title="TG SignPulse"
              value={versionInfo ? <span className="num">v{versionInfo.version}</span> : undefined}
            />
            <ListRow
              icon={<RowIcon icon={ArrowsClockwise} />}
              title={t("software_update")}
              value={<UpdateRowValue t={t} />}
              chevron
              onClick={() => setSheet("update")}
            />
            <ListRow
              icon={<RowIcon icon={GithubLogo} tone="gray" />}
              title={t("github_repo")}
              href={GITHUB_URL}
              external
              accessory={<ArrowSquareOut size={16} className="flex-none text-label-3" aria-hidden />}
            />
          </ListSection>

          <ListSection>
            <button
              type="button"
              onClick={handleLogout}
              className="list-row justify-center text-body text-danger"
            >
              <SignOut size={18} weight="bold" aria-hidden />
              {t("logout")}
            </button>
          </ListSection>

          {versionInfo?.built_at ? (
            <p className="text-center text-caption text-label-3 num">
              {t("built_at")} {versionInfo.built_at}
            </p>
          ) : null}
        </div>
      </div>

      <UsernameSheet open={sheet === "username"} busy={busy} t={t} onClose={closeSheet} onSubmit={handleChangeUsername} />
      <PasswordSheet
        open={sheet === "password"}
        busy={busy}
        mustChange={mustChangePassword}
        t={t}
        onClose={closeSheet}
        onSubmit={handleChangePassword}
      />
      <TotpSheet
        open={sheet === "totp"}
        enabled={totpEnabled}
        token={token}
        t={t}
        onClose={closeSheet}
        onSetup={handleSetupTOTP}
        onEnable={handleEnableTOTP}
        onDisable={handleDisableTOTP}
      />
      <AISheet
        open={sheet === "ai"}
        config={aiConfig}
        busy={busy}
        t={t}
        onClose={closeSheet}
        onSave={handleSaveAI}
        onTest={handleTestAI}
        onDelete={handleDeleteAI}
      />
      <TelegramBotNotificationSheet
        open={sheet === "bot"}
        settings={globalSettings}
        saving={busy}
        t={t}
        onClose={closeSheet}
        onSave={handleSaveGlobal}
      />
      <GlobalSettingsSheet
        open={sheet === "global"}
        settings={globalSettings}
        busy={busy}
        t={t}
        onClose={closeSheet}
        onSave={handleSaveGlobal}
      />
      <TelegramApiSheet
        open={sheet === "telegram"}
        config={telegramConfig}
        busy={busy}
        t={t}
        onClose={closeSheet}
        onSave={handleSaveTelegram}
        onReset={handleResetTelegram}
      />
      <UpdateSheet open={sheet === "update"} t={t} language={language} onClose={closeSheet} />
      <BackupSheet
        open={sheet === "backup"}
        busy={busy}
        t={t}
        onClose={closeSheet}
        onExport={handleExport}
        onImport={handleImport}
      />
    </>
  );
}
