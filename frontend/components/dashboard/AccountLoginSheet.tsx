"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ArrowClockwise, QrCode } from "@phosphor-icons/react";
import { startAccountLogin, verifyAccountLogin, AccountInfo } from "../../lib/api";
import { cn, fmt } from "../../lib/utils";
import { formatError } from "../../lib/tasks";
import { useLanguage } from "../../context/LanguageContext";
import { Sheet } from "../ui/sheet";
import { useToast } from "../ui/toast";
import { Segmented, Spinner } from "../ui/controls";
import { FieldRow, ListSection, RowInput } from "../ui/list";
import { useQrLogin } from "./useQrLogin";

export interface LoginFormData {
  account_name: string;
  phone_number: string;
  proxy: string;
  phone_code: string;
  password: string;
  phone_code_hash: string;
}

export const EMPTY_LOGIN_DATA: LoginFormData = {
  account_name: "",
  phone_number: "",
  proxy: "",
  phone_code: "",
  password: "",
  phone_code_hash: "",
};

export const sanitizeAccountName = (name: string) =>
  name.replace(/[^A-Za-z0-9一-鿿]/g, "");

const normalizeAccountName = (name: string) => name.trim();

export interface ReloginTarget {
  name: string;
  proxy?: string | null;
}

interface AccountLoginSheetProps {
  open: boolean;
  /** 传入时为重新登录，否则为添加账号 */
  relogin: ReloginTarget | null;
  accounts: AccountInfo[];
  token: string | null;
  onClose: () => void;
  onSuccess: (accountName: string) => void;
}

/** 添加账号 / 重新登录：验证码登录与扫码登录两种方式 */
export function AccountLoginSheet({ open, relogin, accounts, token, onClose, onSuccess }: AccountLoginSheetProps) {
  const { t } = useLanguage();
  const { addToast } = useToast();
  const [loginData, setLoginData] = useState<LoginFormData>({ ...EMPTY_LOGIN_DATA });
  const [loginMode, setLoginMode] = useState<"phone" | "qr">("phone");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const reloginName = relogin?.name ?? null;

  const formatErrorMessage = useCallback((key: string, err?: any) => formatError(t, key, err), [t]);

  const updateLoginData = useCallback((patch: Partial<LoginFormData>) => {
    setLoginData((prev) => ({ ...prev, ...patch }));
  }, []);

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
    if (isDuplicateAccountName(trimmed, reloginName)) {
      if (!silent) addToast(t("account_name_duplicate"), "error");
      return null;
    }
    return trimmed;
  };

  const handleLoginSuccess = (accountName: string) => {
    addToast(t("login_success"), "success");
    setLoginData({ ...EMPTY_LOGIN_DATA });
    onSuccess(accountName);
  };

  const qr = useQrLogin({
    token,
    active: open && loginMode === "qr",
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

  // 每次打开时按「添加 / 重新登录」重置表单
  useEffect(() => {
    if (!open) return;
    resetQrState();
    setLoginMode("phone");
    setLoginData({
      ...EMPTY_LOGIN_DATA,
      account_name: relogin?.name || "",
      proxy: relogin?.proxy || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, relogin?.name]);

  const handleStartLogin = async () => {
    if (!token) return;
    const trimmedAccountName = normalizeAccountName(loginData.account_name);
    if (!trimmedAccountName || !loginData.phone_number) {
      addToast(t("account_name_phone_required"), "error");
      return;
    }
    if (isDuplicateAccountName(trimmedAccountName, reloginName)) {
      addToast(t("account_name_duplicate"), "error");
      return;
    }
    try {
      setSending(true);
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
      setSending(false);
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
      setVerifying(true);
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
      setVerifying(false);
    }
  };

  const handleLoginModeChange = (mode: "phone" | "qr") => {
    if (mode === "phone" && loginMode !== "phone" && qr.qrLogin?.login_id) {
      cancelQrLogin();
    }
    setLoginMode(mode);
  };

  const handleClose = () => {
    if (qr.qrLogin?.login_id) {
      cancelQrLogin();
    }
    onClose();
  };

  const codeSent = Boolean(loginData.phone_code_hash);
  const qrWaiting = qr.qrPhase === "ready" || qr.qrPhase === "scanning";

  const qrStatusText =
    qr.qrPhase === "loading" || qr.qrPhase === "ready"
      ? t("qr_waiting")
      : qr.qrPhase === "scanning"
        ? t("qr_scanned")
        : qr.qrPhase === "password"
          ? t("qr_password_required")
          : qr.qrPhase === "success"
            ? t("qr_success")
            : qr.qrPhase === "expired"
              ? t("qr_expired")
              : qr.qrPhase === "error"
                ? t("qr_failed")
                : t("qr_tip");

  const accountNameRow = (
    <FieldRow label={t("field_account_name")} htmlFor="login-account-name">
      <RowInput
        id="login-account-name"
        type="text"
        autoComplete="off"
        placeholder={t("account_name_placeholder")}
        value={loginData.account_name}
        onChange={(e) => updateLoginData({ account_name: sanitizeAccountName(e.target.value) })}
      />
    </FieldRow>
  );

  const proxyRow = (
    <FieldRow label={t("field_proxy")} htmlFor="login-proxy">
      <RowInput
        id="login-proxy"
        type="text"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="socks5://ip:port"
        value={loginData.proxy}
        onChange={(e) => updateLoginData({ proxy: e.target.value })}
      />
    </FieldRow>
  );

  const footer =
    loginMode === "phone" ? (
      <button
        type="button"
        className="btn btn-primary btn-lg w-full"
        onClick={handleVerifyLogin}
        disabled={verifying || !loginData.phone_code.trim()}
      >
        {verifying ? <Spinner className="text-white" /> : null}
        {t("confirm_login")}
      </button>
    ) : qr.qrPhase === "password" ? (
      <button
        type="button"
        className="btn btn-primary btn-lg w-full"
        onClick={qr.submitPassword}
        disabled={!qr.qrPassword || qr.qrPasswordLoading}
      >
        {qr.qrPasswordLoading ? <Spinner className="text-white" /> : null}
        {t("qr_password_submit")}
      </button>
    ) : (
      <button
        type="button"
        className="btn btn-primary btn-lg w-full"
        onClick={qr.startLogin}
        disabled={qr.qrLoading}
      >
        {qr.qrLoading ? <Spinner className="text-white" /> : null}
        {qr.qrLogin ? t("qr_refresh") : t("qr_start")}
      </button>
    );

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={relogin ? t("relogin_account") : t("add_account")}
      subtitle={relogin ? relogin.name : undefined}
      size="sm"
      footer={footer}
    >
      <div className="space-y-6 pt-1">
        {relogin ? (
          <p className="rounded-group bg-warning-soft px-4 py-3 text-subhead">
            {fmt(t("relogin_intro"), { name: relogin.name })}
          </p>
        ) : null}

        <Segmented
          value={loginMode}
          onChange={handleLoginModeChange}
          label={t("login_method")}
          options={[
            { value: "phone", label: t("login_method_phone") },
            { value: "qr", label: t("login_method_qr") },
          ]}
        />

        {loginMode === "phone" ? (
          <>
            <ListSection footer={t("login_phone_hint")}>
              {accountNameRow}
              <FieldRow label={t("field_phone")} htmlFor="login-phone">
                <RowInput
                  id="login-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder={t("phone_number_placeholder")}
                  value={loginData.phone_number}
                  onChange={(e) => updateLoginData({ phone_number: e.target.value })}
                />
              </FieldRow>
              <FieldRow label={t("field_code")} htmlFor="login-code">
                <RowInput
                  id="login-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={t("login_code_placeholder")}
                  value={loginData.phone_code}
                  onChange={(e) => updateLoginData({ phone_code: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-tinted flex-none"
                  onClick={handleStartLogin}
                  disabled={sending}
                >
                  {sending ? <Spinner className="h-3.5 w-3.5 border-[1.5px]" /> : null}
                  {codeSent ? t("resend_code") : t("send_code")}
                </button>
              </FieldRow>
            </ListSection>

            <ListSection header={t("optional_settings")} footer={t("login_optional_hint")}>
              <FieldRow label={t("field_2fa")} htmlFor="login-password">
                <RowInput
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("two_step_placeholder")}
                  value={loginData.password}
                  onChange={(e) => updateLoginData({ password: e.target.value })}
                />
              </FieldRow>
              {proxyRow}
            </ListSection>
          </>
        ) : (
          <>
            <div className="group-list flex flex-col items-center px-4 pb-5 pt-5 text-center">
              <div
                className={cn(
                  "relative flex h-[200px] w-[200px] items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-black/5",
                  qr.qrPhase === "expired" && "opacity-40"
                )}
              >
                {qr.qrLogin?.qr_image ? (
                  <Image src={qr.qrLogin.qr_image} alt={t("qr_alt")} width={184} height={184} unoptimized />
                ) : qr.qrLoading ? (
                  <Spinner className="h-7 w-7 text-[#6c6c70]" />
                ) : (
                  <QrCode size={64} className="text-[#aeaeb2]" aria-hidden />
                )}
              </div>
              <p
                className={cn(
                  "mt-4 text-headline",
                  qr.qrPhase === "error" && "text-danger",
                  qr.qrPhase === "password" && "text-warning",
                  qr.qrPhase === "success" && "text-success"
                )}
                aria-live="polite"
              >
                {qrStatusText}
              </p>
              {qr.qrLogin && qrWaiting ? (
                <p className="mt-1 text-footnote text-label-2 num">
                  {fmt(t("qr_expires_in"), { seconds: qr.qrCountdown })}
                </p>
              ) : (
                <p className="mt-1 max-w-[30ch] text-footnote text-label-2">{t("qr_steps")}</p>
              )}
              {qr.qrMessage && qr.qrPhase !== "password" ? (
                <p className="mt-2 text-footnote text-danger">{qr.qrMessage}</p>
              ) : null}
              {qr.qrLogin && qrWaiting ? (
                <button
                  type="button"
                  onClick={qr.startLogin}
                  disabled={qr.qrLoading}
                  className="btn btn-sm btn-plain mt-2"
                >
                  <ArrowClockwise size={16} weight="bold" aria-hidden />
                  {t("qr_refresh")}
                </button>
              ) : null}
            </div>

            <ListSection footer={t("login_qr_hint")}>
              {accountNameRow}
              <FieldRow label={t("field_2fa")} htmlFor="login-qr-password">
                <RowInput
                  id="login-qr-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("two_step_placeholder")}
                  value={qr.qrPassword}
                  onChange={(e) => qr.setQrPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    if (qr.qrPhase !== "password") return;
                    if (!qr.qrPassword || qr.qrPasswordLoading) return;
                    e.preventDefault();
                    qr.submitPassword();
                  }}
                />
              </FieldRow>
              {proxyRow}
            </ListSection>
          </>
        )}
      </div>
    </Sheet>
  );
}
