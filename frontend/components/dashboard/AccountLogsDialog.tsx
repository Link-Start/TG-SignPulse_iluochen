"use client";

import { ListDashes, Spinner, Trash, X } from "@phosphor-icons/react";
import type { AccountLog } from "../../lib/api";

interface AccountLogsDialogProps {
  accountName: string;
  logs: AccountLog[];
  logsLoading: boolean;
  clearing: boolean;
  t: (key: string) => string;
  onClear: () => void;
  onClose: () => void;
}

export function AccountLogsDialog({
  accountName,
  logs,
  logsLoading,
  clearing,
  t,
  onClear,
  onClose,
}: AccountLogsDialogProps) {
  const plainMessages = ["Success", "Failed", t("task_exec_success"), t("task_exec_failed")];

  return (
    <div className="modal-overlay active">
      <div className="glass-panel modal-content !max-w-4xl max-h-[90vh] flex flex-col overflow-hidden !p-0" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#8a3ffc]/10 rounded-lg text-[#8a3ffc]">
              <ListDashes weight="bold" size={18} />
            </div>
            <div className="font-bold text-lg">{accountName} {t("running_logs")}</div>
          </div>
          <div className="modal-close" onClick={onClose}><X weight="bold" /></div>
        </div>

        <div className="px-5 py-3 border-b border-white/5 flex justify-between items-center bg-white/2">
          <div className="text-[10px] text-main/30 font-bold uppercase tracking-wider">
            {t("logs_summary")
              .replace("{count}", logs.length.toString())
              .replace("{days}", "3")}
          </div>
          {logs.length > 0 && (
            <button
              onClick={onClear}
              disabled={clearing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-[10px] font-bold hover:bg-rose-500/20 transition-all disabled:opacity-50"
            >
              <Trash weight="bold" size={14} />
              {t("clear_logs")}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 font-mono text-[13px] bg-black/10 custom-scrollbar">
          {logsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-main/30">
              <Spinner className="animate-spin mb-4" size={32} />
              {t("loading")}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20 text-main/20 font-sans">{t("no_logs")}</div>
          ) : (
            <div className="space-y-3">
              {logs.map((log, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/2 border border-white/5 group hover:border-white/10 transition-colors">
                  <div className="flex justify-between items-center mb-2.5 text-[10px] uppercase tracking-wider font-bold">
                    <span className="text-main/20 group-hover:text-main/40 transition-colors">{new Date(log.created_at).toLocaleString()}</span>
                    <span className={`px-2 py-0.5 rounded-md ${log.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {log.success ? t("success") : t("failure")}
                    </span>
                  </div>
                  <div className="text-main/70 font-semibold mb-2">
                    {`${t("task_label")}: ${log.task_name} ${log.success ? t("task_exec_success") : t("task_exec_failed")}`}
                  </div>
                  {log.bot_message ? (
                    <div className="text-main/60 leading-relaxed whitespace-pre-wrap break-words mb-2">
                      <span className="text-main/35">{t("bot_reply")}: </span>
                      {log.bot_message}
                    </div>
                  ) : null}
                  {log.message && !plainMessages.includes(log.message.trim()) ? (
                    <pre className="whitespace-pre-wrap text-main/45 leading-relaxed overflow-x-auto max-h-[120px] scrollbar-none font-medium">
                      {log.message}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/5 text-center bg-white/2">
          <button className="btn-secondary px-8 h-9 !py-0 mx-auto !text-xs" onClick={onClose}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
