"use client";

import { Spinner, X } from "@phosphor-icons/react";

export interface EditAccountData {
  account_name: string;
  remark: string;
  proxy: string;
}

interface EditAccountDialogProps {
  data: EditAccountData;
  saving: boolean;
  t: (key: string) => string;
  onChange: (data: EditAccountData) => void;
  onSave: () => void;
  onRelogin: () => void;
  onClose: () => void;
}

export function EditAccountDialog({ data, saving, t, onChange, onSave, onRelogin, onClose }: EditAccountDialogProps) {
  return (
    <div className="modal-overlay active">
      <div className="glass-panel modal-content !max-w-[420px] !p-6" onClick={e => e.stopPropagation()}>
        <div className="modal-header !mb-5">
          <div className="modal-title !text-lg">{t("edit_account")}</div>
          <div className="modal-close" onClick={onClose}><X weight="bold" /></div>
        </div>

        <div className="animate-float-up space-y-4">
          <div>
            <label className="text-[11px] mb-1">{t("session_name")}</label>
            <input
              type="text"
              className="!py-2.5 !px-4 !mb-4"
              value={data.account_name}
              disabled
            />

            <label className="text-[11px] mb-1">{t("remark")}</label>
            <input
              type="text"
              className="!py-2.5 !px-4 !mb-4"
              placeholder={t("remark_placeholder")}
              value={data.remark}
              onChange={(e) => onChange({ ...data, remark: e.target.value })}
            />

            <label className="text-[11px] mb-1">{t("proxy")}</label>
            <input
              type="text"
              className="!py-2.5 !px-4"
              placeholder={t("proxy_placeholder")}
              style={{ marginBottom: 0 }}
              value={data.proxy}
              onChange={(e) => onChange({ ...data, proxy: e.target.value })}
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button
              className="btn-secondary flex-1 h-10 !py-0 !text-xs !bg-amber-500/10 !text-amber-500 hover:!bg-amber-500/20"
              onClick={onRelogin}
            >
              {t("relogin") || "Re-login"}
            </button>
            <button className="btn-secondary flex-1 h-10 !py-0 !text-xs" onClick={onClose}>{t("cancel")}</button>
            <button className="btn-gradient flex-1 h-10 !py-0 !text-xs" onClick={onSave} disabled={saving}>
              {saving ? <Spinner className="animate-spin" /> : t("save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
