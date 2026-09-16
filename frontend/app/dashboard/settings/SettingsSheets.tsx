"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, FileArrowUp, FloppyDisk, Trash, WarningCircle } from "@phosphor-icons/react";
import type { AIConfig, GlobalSettings, TelegramConfig } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { Sheet } from "../../../components/ui/sheet";
import { Spinner, Switch } from "../../../components/ui/controls";
import { FieldRow, ListRow, ListSection, RowInput } from "../../../components/ui/list";

type T = (key: string) => string;

function PrimaryButton({ busy, disabled, onClick, children, tone = "primary" }: {
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "primary" | "danger";
}) {
  return (
    <button
      type="button"
      className={cn("btn btn-lg w-full", tone === "danger" ? "btn-danger-tinted" : "btn-primary")}
      disabled={busy || disabled}
      onClick={onClick}
    >
      {busy ? <Spinner className={tone === "primary" ? "text-white" : undefined} /> : null}
      {children}
    </button>
  );
}

/** 回车提交：表单里放一个隐藏的提交按钮 */
function SheetForm({ onSubmit, children }: { onSubmit: () => void; children: React.ReactNode }) {
  return (
    <form
      className="space-y-6 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
      <button type="submit" hidden aria-hidden tabIndex={-1} />
    </form>
  );
}

function Notice({ tone = "warning", children }: { tone?: "warning" | "danger"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "flex gap-2.5 rounded-group px-4 py-3 text-subhead",
        tone === "danger" ? "bg-danger-soft" : "bg-warning-soft"
      )}
    >
      <WarningCircle
        size={20}
        weight="fill"
        className={cn("mt-px flex-none", tone === "danger" ? "text-danger-dot" : "text-warning-dot")}
        aria-hidden
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ── 用户名 ───────────────────────────────────────────────────────────

export function UsernameSheet({ open, busy, t, onClose, onSubmit }: {
  open: boolean;
  busy: boolean;
  t: T;
  onClose: () => void;
  onSubmit: (newUsername: string, password: string) => Promise<boolean>;
}) {
  const [form, setForm] = useState({ newUsername: "", password: "" });
  useEffect(() => {
    if (open) setForm({ newUsername: "", password: "" });
  }, [open]);
  const submit = () => {
    if (!busy) onSubmit(form.newUsername.trim(), form.password);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("change_username")}
      size="sm"
      footer={<PrimaryButton busy={busy} onClick={submit}>{t("change_username")}</PrimaryButton>}
    >
      <SheetForm onSubmit={submit}>
        <ListSection footer={t("change_username_hint")}>
          <FieldRow label={t("new_username")} htmlFor="new-username">
            <RowInput
              id="new-username"
              autoComplete="username"
              autoCapitalize="off"
              value={form.newUsername}
              onChange={(e) => setForm({ ...form, newUsername: e.target.value })}
              placeholder={t("new_username_placeholder")}
            />
          </FieldRow>
          <FieldRow label={t("current_password")} htmlFor="username-password">
            <RowInput
              id="username-password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={t("current_password_placeholder")}
            />
          </FieldRow>
        </ListSection>
      </SheetForm>
    </Sheet>
  );
}

// ── 密码 ─────────────────────────────────────────────────────────────

export function PasswordSheet({ open, busy, mustChange, t, onClose, onSubmit }: {
  open: boolean;
  busy: boolean;
  mustChange: boolean;
  t: T;
  onClose: () => void;
  onSubmit: (oldPassword: string, newPassword: string, confirmPassword: string) => Promise<boolean>;
}) {
  const [form, setForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  useEffect(() => {
    if (open) setForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
  }, [open]);
  const mismatch = Boolean(form.confirmPassword) && form.newPassword !== form.confirmPassword;
  const submit = () => {
    if (!busy) onSubmit(form.oldPassword, form.newPassword, form.confirmPassword);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("change_password")}
      size="sm"
      footer={<PrimaryButton busy={busy} onClick={submit}>{t("change_password")}</PrimaryButton>}
    >
      <SheetForm onSubmit={submit}>
        {mustChange ? <Notice tone="danger">{t("default_password_warning")}</Notice> : null}
        <ListSection>
          <FieldRow label={t("old_password")} htmlFor="old-password">
            <RowInput
              id="old-password"
              type="password"
              autoComplete="current-password"
              value={form.oldPassword}
              onChange={(e) => setForm({ ...form, oldPassword: e.target.value })}
              placeholder={t("required")}
            />
          </FieldRow>
        </ListSection>
        <ListSection
          footer={mismatch ? <span className="text-danger">{t("password_mismatch")}</span> : t("password_hint")}
        >
          <FieldRow label={t("new_password")} htmlFor="new-password">
            <RowInput
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              placeholder={t("required")}
            />
          </FieldRow>
          <FieldRow label={t("confirm_password_short")} htmlFor="confirm-password">
            <RowInput
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={mismatch || undefined}
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              placeholder={t("confirm_password_placeholder")}
            />
          </FieldRow>
        </ListSection>
      </SheetForm>
    </Sheet>
  );
}

// ── 两步验证 ─────────────────────────────────────────────────────────

function CodeInput({ id, value, onChange, label }: { id: string; value: string; onChange: (value: string) => void; label: string }) {
  return (
    <div>
      <label htmlFor={id} className="group-header block">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        className="text-field num h-14 text-center text-[28px] font-semibold tracking-[0.35em] placeholder:tracking-[0.35em]"
      />
    </div>
  );
}

export function TotpSheet({ open, enabled, token, t, onClose, onSetup, onEnable, onDisable }: {
  open: boolean;
  enabled: boolean;
  token: string | null;
  t: T;
  onClose: () => void;
  onSetup: () => Promise<string | null>;
  onEnable: (code: string) => Promise<boolean>;
  onDisable: (code: string) => Promise<boolean>;
}) {
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setSecret("");
      setCode("");
      setCopied(false);
    }
  }, [open]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const startSetup = () =>
    run(async () => {
      const next = await onSetup();
      if (next) setSecret(next);
    });

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const setupMode = !enabled && Boolean(secret);
  const canSubmitCode = code.length === 6;

  let footer: React.ReactNode;
  if (enabled) {
    footer = (
      <PrimaryButton tone="danger" busy={busy} disabled={!canSubmitCode} onClick={() => run(() => onDisable(code))}>
        {t("disable_2fa")}
      </PrimaryButton>
    );
  } else if (setupMode) {
    footer = (
      <PrimaryButton busy={busy} disabled={!canSubmitCode} onClick={() => run(() => onEnable(code))}>
        {t("verify_and_enable")}
      </PrimaryButton>
    );
  } else {
    footer = (
      <PrimaryButton busy={busy} onClick={startSetup}>
        {t("start_setup")}
      </PrimaryButton>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("2fa_settings")}
      subtitle={enabled ? <span className="text-success">{t("status_enabled")}</span> : t("status_disabled")}
      size="sm"
      footer={footer}
    >
      <div className="space-y-6 pt-1">
        {enabled ? (
          <>
            <p className="px-1 text-subhead text-label-2">{t("2fa_disable_desc")}</p>
            <CodeInput id="totp-disable" label={t("verify_code")} value={code} onChange={setCode} />
          </>
        ) : setupMode ? (
          <>
            <div className="group-list flex flex-col items-center px-4 py-5 text-center">
              <div className="rounded-xl bg-white p-2 ring-1 ring-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/user/totp/qrcode?token=${token}`} alt={t("qr_alt")} className="h-40 w-40" />
              </div>
              <p className="mt-3 text-headline">{t("scan_qr")}</p>
              <p className="mt-1 max-w-[32ch] text-footnote text-label-2">{t("scan_qr_desc")}</p>
            </div>
            <ListSection header={t("backup_secret")}>
              <div className="list-row">
                <code className="min-w-0 flex-1 break-all font-mono text-subhead">{secret}</code>
                <button type="button" onClick={copySecret} className="btn btn-sm btn-tinted flex-none">
                  <Copy size={15} weight="bold" aria-hidden />
                  {copied ? t("copied") : t("copy")}
                </button>
              </div>
            </ListSection>
            <CodeInput id="totp-enable" label={t("verify_code")} value={code} onChange={setCode} />
          </>
        ) : (
          <p className="px-1 text-subhead text-label-2">{t("2fa_enable_desc")}</p>
        )}
      </div>
    </Sheet>
  );
}

// ── AI ───────────────────────────────────────────────────────────────

export interface AIForm {
  api_key: string;
  base_url: string;
  model: string;
}

export function AISheet({ open, config, busy, t, onClose, onSave, onTest, onDelete }: {
  open: boolean;
  config: AIConfig | null;
  busy: boolean;
  t: T;
  onClose: () => void;
  onSave: (form: AIForm) => void;
  onTest: () => Promise<{ ok: boolean; message: string }>;
  onDelete: () => void;
}) {
  const [form, setForm] = useState<AIForm>({ api_key: "", base_url: "", model: "gpt-4o" });
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({ api_key: "", base_url: config?.base_url || "", model: config?.model || "gpt-4o" });
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, config]);

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult(await onTest());
    } finally {
      setTesting(false);
    }
  };

  const hasConfig = Boolean(config?.has_config);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("ai_config")}
      size="sm"
      footer={<PrimaryButton busy={busy} onClick={() => onSave(form)}>{t("save")}</PrimaryButton>}
    >
      <SheetForm onSubmit={() => !busy && onSave(form)}>
        <ListSection footer={config?.api_key_masked ? t("api_key_keep_hint") : t("ai_config_desc")}>
          <FieldRow label={t("api_key")} htmlFor="ai-key">
            <RowInput
              id="ai-key"
              type="password"
              autoComplete="off"
              className="mono"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder={config?.api_key_masked || "sk-…"}
            />
          </FieldRow>
          <FieldRow label={t("base_url")} htmlFor="ai-base">
            <RowInput
              id="ai-base"
              type="url"
              inputMode="url"
              autoCapitalize="off"
              spellCheck={false}
              value={form.base_url}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              placeholder={t("ai_base_url_placeholder")}
            />
          </FieldRow>
          <FieldRow label={t("model")} htmlFor="ai-model">
            <RowInput
              id="ai-model"
              autoCapitalize="off"
              spellCheck={false}
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </FieldRow>
        </ListSection>

        <ListSection footer={t("ai_test_hint")}>
          <div className="list-row py-2">
            <button type="button" className="btn btn-sm btn-tinted" onClick={test} disabled={testing || !hasConfig}>
              {testing ? <Spinner className="h-3.5 w-3.5 border-[1.5px]" /> : null}
              {t("test_connection")}
            </button>
            {result ? (
              <span role="status" className={cn("min-w-0 flex-1 text-footnote", result.ok ? "text-success" : "text-danger")}>
                {result.message}
              </span>
            ) : null}
          </div>
        </ListSection>

        {hasConfig ? (
          <ListSection>
            <ListRow
              icon={<Trash size={22} className="text-danger" />}
              title={t("delete_ai_config")}
              tone="danger"
              onClick={onDelete}
              disabled={busy}
            />
          </ListSection>
        ) : null}
      </SheetForm>
    </Sheet>
  );
}

// ── 全局参数 ─────────────────────────────────────────────────────────

export function GlobalSettingsSheet({ open, settings, busy, t, onClose, onSave }: {
  open: boolean;
  settings: GlobalSettings;
  busy: boolean;
  t: T;
  onClose: () => void;
  onSave: (patch: GlobalSettings) => void;
}) {
  const [draft, setDraft] = useState<GlobalSettings>(settings);
  useEffect(() => {
    if (open) setDraft(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = () =>
    onSave({
      sign_interval: draft.sign_interval,
      log_retention_days: draft.log_retention_days,
      data_dir: draft.data_dir,
      global_proxy: draft.global_proxy,
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("global_settings")}
      size="sm"
      footer={<PrimaryButton busy={busy} onClick={save}>{t("save")}</PrimaryButton>}
    >
      <SheetForm onSubmit={() => !busy && save()}>
        <ListSection footer={t("sign_interval_desc")}>
          <FieldRow label={t("sign_interval_short")} htmlFor="sign-interval">
            <RowInput
              id="sign-interval"
              inputMode="numeric"
              align="right"
              className="num"
              value={draft.sign_interval ?? ""}
              onChange={(e) => {
                const value = e.target.value.replace(/[^\d]/g, "");
                setDraft({ ...draft, sign_interval: value ? parseInt(value, 10) : null });
              }}
              placeholder={t("sign_interval_placeholder")}
            />
            <span className="flex-none text-body text-label-2">{t("unit_seconds")}</span>
          </FieldRow>
          <FieldRow label={t("log_retention_short")} htmlFor="log-retention">
            <RowInput
              id="log-retention"
              inputMode="numeric"
              align="right"
              className="num"
              value={draft.log_retention_days ?? ""}
              onChange={(e) => {
                const value = e.target.value.replace(/[^\d]/g, "");
                setDraft({ ...draft, log_retention_days: value ? parseInt(value, 10) : 0 });
              }}
            />
            <span className="flex-none text-body text-label-2">{t("unit_days")}</span>
          </FieldRow>
        </ListSection>

        <ListSection
          footer={
            <>
              {t("data_dir_desc")}
              <span className="mt-1 block text-warning">{t("data_dir_restart_hint")}</span>
            </>
          }
        >
          <FieldRow stacked label={t("data_dir")} htmlFor="data-dir">
            <input
              id="data-dir"
              className="text-field bg-fill mono"
              autoCapitalize="off"
              spellCheck={false}
              value={draft.data_dir || ""}
              onChange={(e) => setDraft({ ...draft, data_dir: e.target.value || null })}
              placeholder={t("data_dir_placeholder")}
            />
          </FieldRow>
        </ListSection>

        <ListSection footer={t("global_proxy_desc")}>
          <FieldRow stacked label={t("global_proxy")} htmlFor="global-proxy">
            <input
              id="global-proxy"
              className="text-field bg-fill mono"
              inputMode="url"
              autoCapitalize="off"
              spellCheck={false}
              value={draft.global_proxy || ""}
              onChange={(e) => setDraft({ ...draft, global_proxy: e.target.value || null })}
              placeholder={t("global_proxy_placeholder")}
            />
          </FieldRow>
        </ListSection>
      </SheetForm>
    </Sheet>
  );
}

// ── Telegram API ─────────────────────────────────────────────────────

export function TelegramApiSheet({ open, config, busy, t, onClose, onSave, onReset }: {
  open: boolean;
  config: TelegramConfig | null;
  busy: boolean;
  t: T;
  onClose: () => void;
  onSave: (apiId: string, apiHash: string) => void;
  onReset: () => void;
}) {
  const [form, setForm] = useState({ api_id: "", api_hash: "" });
  useEffect(() => {
    if (open) setForm({ api_id: config?.api_id?.toString() || "", api_hash: config?.api_hash || "" });
  }, [open, config]);
  const save = () => onSave(form.api_id.trim(), form.api_hash.trim());

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("tg_api_config")}
      subtitle={config ? (config.is_custom ? t("tg_api_custom") : t("tg_api_default")) : undefined}
      size="sm"
      footer={<PrimaryButton busy={busy} onClick={save}>{t("apply_api_config")}</PrimaryButton>}
    >
      <SheetForm onSubmit={() => !busy && save()}>
        <Notice>{t("tg_config_warning")}</Notice>
        <ListSection footer={t("tg_api_hint")}>
          <FieldRow label={t("api_id")} htmlFor="tg-api-id">
            <RowInput
              id="tg-api-id"
              inputMode="numeric"
              className="mono"
              value={form.api_id}
              onChange={(e) => setForm({ ...form, api_id: e.target.value })}
              placeholder={t("tg_api_id_placeholder")}
            />
          </FieldRow>
          <FieldRow label={t("api_hash")} htmlFor="tg-api-hash">
            <RowInput
              id="tg-api-hash"
              autoCapitalize="off"
              spellCheck={false}
              className="mono"
              value={form.api_hash}
              onChange={(e) => setForm({ ...form, api_hash: e.target.value })}
              placeholder={t("tg_api_hash_placeholder")}
            />
          </FieldRow>
        </ListSection>
        {config?.is_custom ? (
          <ListSection>
            <ListRow title={t("restore_default")} tone="danger" onClick={onReset} disabled={busy} />
          </ListSection>
        ) : null}
      </SheetForm>
    </Sheet>
  );
}

// ── 备份与迁移 ───────────────────────────────────────────────────────

export function BackupSheet({ open, busy, t, onClose, onExport, onImport }: {
  open: boolean;
  busy: boolean;
  t: T;
  onClose: () => void;
  onExport: () => void;
  onImport: (content: string, overwrite: boolean) => Promise<boolean>;
}) {
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setContent("");
      setFileName("");
      setOverwrite(false);
    }
  }, [open]);

  const submit = async () => {
    const ok = await onImport(content, overwrite);
    if (ok) {
      setContent("");
      setFileName("");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("backup_migration")}
      size="md"
      tall
      footer={
        <PrimaryButton busy={busy} disabled={!content.trim()} onClick={submit}>
          {t("execute_import")}
        </PrimaryButton>
      }
    >
      <div className="space-y-6 pt-1">
        <ListSection header={t("export_config")} footer={t("export_desc")}>
          <ListRow
            icon={<FloppyDisk size={22} className="text-accent-text" />}
            title={t("download_json")}
            tone="accent"
            onClick={onExport}
            disabled={busy}
          />
        </ListSection>

        <ListSection header={t("import_config")} footer={t("import_desc")}>
          <ListRow
            icon={<FileArrowUp size={22} className="text-accent-text" />}
            title={t("upload_json")}
            tone="accent"
            value={fileName || undefined}
            onClick={() => fileRef.current?.click()}
          />
          <div className="list-row py-3">
            <label htmlFor="import-json" className="sr-only">
              {t("paste_json")}
            </label>
            <textarea
              id="import-json"
              rows={6}
              className="text-field bg-fill mono min-h-[132px] text-[13px] leading-[19px]"
              placeholder={t("paste_json")}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setFileName("");
              }}
            />
          </div>
          <div className="list-row">
            <span className="min-w-0 flex-1">
              <span className="block text-body">{t("overwrite_conflict")}</span>
              <span className="mt-0.5 block text-footnote text-label-2">{t("overwrite_conflict_desc")}</span>
            </span>
            <Switch checked={overwrite} label={t("overwrite_conflict")} onChange={setOverwrite} />
          </div>
        </ListSection>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              setContent(String(ev.target?.result || ""));
              setFileName(file.name);
            };
            reader.readAsText(file);
            e.target.value = "";
          }}
        />
      </div>
    </Sheet>
  );
}
