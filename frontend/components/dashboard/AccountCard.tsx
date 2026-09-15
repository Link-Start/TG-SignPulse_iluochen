"use client";

import { memo } from "react";
import { Clock, ListDashes, PencilSimple, Trash } from "@phosphor-icons/react";
import type { AccountInfo, AccountStatusItem } from "../../lib/api";

interface AccountCardProps {
  account: AccountInfo;
  statusInfo?: AccountStatusItem;
  taskCount: number;
  t: (key: string) => string;
  onOpen: (account: AccountInfo) => void;
  onShowLogs: (name: string) => void;
  onEdit: (account: AccountInfo) => void;
  onDelete: (name: string) => void;
}

// memo：扫码倒计时、登录表单输入等页面级状态变化时，账号卡片无需重渲染
export const AccountCard = memo(function AccountCard({
  account: acc,
  statusInfo,
  taskCount,
  t,
  onOpen,
  onShowLogs,
  onEdit,
  onDelete,
}: AccountCardProps) {
  const initial = acc.name.charAt(0).toUpperCase();
  const rawStatus = statusInfo?.status || acc.status || "connected";
  const needsRelogin = Boolean(statusInfo?.needs_relogin || acc.needs_relogin);
  const isInvalid = needsRelogin || rawStatus === "invalid" || rawStatus === "not_found";
  const statusKey = isInvalid ? "account_status_invalid" : "connected";
  const statusIconClass = isInvalid ? "text-rose-400" : "text-emerald-400";

  return (
    <div
      className="glass-panel card !h-44 group cursor-pointer"
      onClick={() => onOpen(acc)}
    >
      <div className="card-top">
        <div className="account-name">
          <div className="account-avatar">{initial}</div>
          <div className="min-w-0">
            <div className="font-bold leading-tight truncate">{acc.name}</div>
            {acc.remark ? (
              <div className="text-xs text-main/40 leading-tight truncate">
                {acc.remark}
              </div>
            ) : null}
          </div>
        </div>
        <div className="task-badge">
          {taskCount} {t("sidebar_tasks")}
        </div>
      </div>

      <div className="flex-1"></div>

      <div className="card-bottom !pt-3">
        <div className="create-time" title={statusInfo?.message || acc.status_message || ""}>
          <Clock weight="fill" className={statusIconClass} />
          <span className="text-[11px] font-medium">{t(statusKey)}</span>
        </div>
        <div className="card-actions">
          <div
            className="action-icon !w-8 !h-8"
            title={t("logs")}
            onClick={(e) => { e.stopPropagation(); onShowLogs(acc.name); }}
          >
            <ListDashes weight="bold" size={16} />
          </div>
          <div
            className="action-icon !w-8 !h-8"
            title={t("edit_account")}
            onClick={(e) => { e.stopPropagation(); onEdit(acc); }}
          >
            <PencilSimple weight="bold" size={16} />
          </div>
          <div
            className="action-icon delete !w-8 !h-8"
            title={t("remove")}
            onClick={(e) => { e.stopPropagation(); onDelete(acc.name); }}
          >
            <Trash weight="bold" size={16} />
          </div>
        </div>
      </div>
    </div>
  );
});
