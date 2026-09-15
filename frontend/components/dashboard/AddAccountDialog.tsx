"use client";

import Image from "next/image";
import { PaperPlaneRight, Spinner, X } from "@phosphor-icons/react";
import type { QrLoginInfo, QrPhase } from "./useQrLogin";

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

interface QrProps {
  qrLogin: QrLoginInfo | null;
  qrPhase: QrPhase;
  qrMessage: string;
  qrCountdown: number;
  qrLoading: boolean;
  qrPassword: string;
  qrPasswordLoading: boolean;
  setQrPassword: (value: string) => void;
  startLogin: () => void;
  submitPassword: () => void;
}

interface AddAccountDialogProps {
  isRelogin: boolean;
  loginMode: "phone" | "qr";
  loginData: LoginFormData;
  loading: boolean;
  qr: QrProps;
  t: (key: string) => string;
  onModeChange: (mode: "phone" | "qr") => void;
  onLoginDataChange: (patch: Partial<LoginFormData>) => void;
  onSendCode: () => void;
  onVerify: () => void;
  onClose: () => void;
}

export function AddAccountDialog({
  isRelogin,
  loginMode,
  loginData,
  loading,
  qr,
  t,
  onModeChange,
  onLoginDataChange,
  onSendCode,
  onVerify,
  onClose,
}: AddAccountDialogProps) {
  const accountNameInput = (
    <>
      <label className="text-[11px] mb-1">{t("session_name")}</label>
      <input
        type="text"
        className="!py-2.5 !px-4 !mb-4"
        placeholder={t("account_name_placeholder")}
        value={loginData.account_name}
        onChange={(e) => onLoginDataChange({ account_name: sanitizeAccountName(e.target.value) })}
      />
    </>
  );

  return (
    <div className="modal-overlay active">
      <div className="glass-panel modal-content modal-content-fit !max-w-[420px] !p-6" onClick={e => e.stopPropagation()}>
        <div className="modal-header !mb-5">
          <div className="modal-title !text-lg">
            {isRelogin ? t("relogin_account") : t("add_account")}
          </div>
          <div className="modal-close" onClick={onClose}><X weight="bold" /></div>
        </div>

        <div className="animate-float-up space-y-4">
          <div className="flex gap-2">
            <button
              className={`flex-1 h-9 text-xs font-bold rounded-lg ${loginMode === "phone" ? "btn-gradient" : "btn-secondary"}`}
              onClick={() => onModeChange("phone")}
            >
              {t("login_method_phone")}
            </button>
            <button
              className={`flex-1 h-9 text-xs font-bold rounded-lg ${loginMode === "qr" ? "btn-gradient" : "btn-secondary"}`}
              onClick={() => onModeChange("qr")}
            >
              {t("login_method_qr")}
            </button>
          </div>

          {loginMode === "phone" ? (
            <>
              <div>
                {accountNameInput}

                <label className="text-[11px] mb-1">{t("phone_number")}</label>
                <input
                  type="text"
                  className="!py-2.5 !px-4 !mb-4"
                  placeholder={t("phone_number_placeholder")}
                  value={loginData.phone_number}
                  onChange={(e) => onLoginDataChange({ phone_number: e.target.value })}
                />

                <label className="text-[11px] mb-1">{t("login_code")}</label>
                <div className="input-group !mb-4">
                  <input
                    type="text"
                    className="!py-2.5 !px-4"
                    placeholder={t("login_code_placeholder")}
                    value={loginData.phone_code}
                    onChange={(e) => onLoginDataChange({ phone_code: e.target.value })}
                  />
                  <button className="btn-code !h-[42px] !w-[42px] !text-lg" onClick={onSendCode} disabled={loading} title={t("send_code")}>
                    {loading ? <Spinner className="animate-spin" size={16} /> : <PaperPlaneRight weight="bold" />}
                  </button>
                </div>

                <label className="text-[11px] mb-1">{t("two_step_pass")}</label>
                <input
                  type="password"
                  className="!py-2.5 !px-4 !mb-4"
                  placeholder={t("two_step_placeholder")}
                  value={loginData.password}
                  onChange={(e) => onLoginDataChange({ password: e.target.value })}
                />

                <label className="text-[11px] mb-1">{t("proxy")}</label>
                <input
                  type="text"
                  className="!py-2.5 !px-4"
                  placeholder={t("proxy_placeholder")}
                  style={{ marginBottom: 0 }}
                  value={loginData.proxy}
                  onChange={(e) => onLoginDataChange({ proxy: e.target.value })}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button className="btn-secondary flex-1 h-10 !py-0 !text-xs" onClick={onClose}>{t("cancel")}</button>
                <button
                  className="btn-gradient flex-1 h-10 !py-0 !text-xs"
                  onClick={onVerify}
                  disabled={loading || !loginData.phone_code.trim()}
                >
                  {loading ? <Spinner className="animate-spin" /> : t("confirm_connect")}
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                {accountNameInput}

                <label className="text-[11px] mb-1">{t("two_step_pass")}</label>
                <input
                  type="password"
                  className="!py-2.5 !px-4 !mb-4"
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
                <label className="text-[11px] mb-1">{t("proxy")}</label>
                <input
                  type="text"
                  className="!py-2.5 !px-4 !mb-4"
                  placeholder={t("proxy_placeholder")}
                  value={loginData.proxy}
                  onChange={(e) => onLoginDataChange({ proxy: e.target.value })}
                />
              </div>

              <div className="glass-panel !bg-black/5 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-main/60">{t("qr_tip")}</div>
                  <button
                    className="btn-secondary h-8 !px-3 !py-0 !text-[11px]"
                    onClick={qr.startLogin}
                    disabled={qr.qrLoading}
                  >
                    {qr.qrLoading ? <Spinner className="animate-spin" /> : (qr.qrLogin ? t("qr_refresh") : t("qr_start"))}
                  </button>
                </div>
                <div className="flex items-center justify-center">
                  {qr.qrLogin?.qr_image ? (
                    <Image src={qr.qrLogin.qr_image} alt={t("qr_alt")} width={160} height={160} className="rounded-lg bg-white p-2" />
                  ) : (
                    <div className="w-40 h-40 rounded-lg bg-white/5 flex items-center justify-center text-xs text-main/40">
                      {t("qr_start")}
                    </div>
                  )}
                </div>
                {qr.qrLogin && (qr.qrPhase === "ready" || qr.qrPhase === "scanning") ? (
                  <div className="text-[11px] text-main/40 font-mono text-center">
                    {t("qr_expires_in").replace("{seconds}", qr.qrCountdown.toString())}
                  </div>
                ) : null}
                <div className="text-xs text-center font-bold">
                  {(qr.qrPhase === "loading" || qr.qrPhase === "ready") && t("qr_waiting")}
                  {qr.qrPhase === "scanning" && t("qr_scanned")}
                  {qr.qrPhase === "password" && t("qr_password_required")}
                  {qr.qrPhase === "success" && t("qr_success")}
                  {qr.qrPhase === "expired" && t("qr_expired")}
                  {qr.qrPhase === "error" && t("qr_failed")}
                </div>
                {qr.qrMessage ? (
                  <div className="text-[11px] text-rose-400 text-center">{qr.qrMessage}</div>
                ) : null}
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  className="btn-secondary flex-1 h-10 !py-0 !text-xs"
                  onClick={onClose}
                >
                  {t("cancel")}
                </button>
                <button
                  className="btn-gradient flex-1 h-10 !py-0 !text-xs"
                  onClick={qr.submitPassword}
                  disabled={qr.qrPhase !== "password" || !qr.qrPassword || qr.qrPasswordLoading}
                >
                  {qr.qrPasswordLoading ? <Spinner className="animate-spin" /> : t("confirm_connect")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
