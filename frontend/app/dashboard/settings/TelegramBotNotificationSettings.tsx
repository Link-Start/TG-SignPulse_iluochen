"use client";

import { useEffect, useState } from "react";
import { GlobalSettings, testTelegramBotNotification } from "../../../lib/api";
import { getToken } from "../../../lib/auth";
import { cn } from "../../../lib/utils";
import { Sheet } from "../../../components/ui/sheet";
import { Spinner, Switch } from "../../../components/ui/controls";
import { FieldRow, ListSection, RowInput } from "../../../components/ui/list";

type T = (key: string) => string;

function SwitchRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className={cn("list-row", disabled && "opacity-50")}>
      <span className="min-w-0 flex-1">
        <span className="block text-body">{title}</span>
        {description ? <span className="mt-0.5 block text-footnote text-label-2">{description}</span> : null}
      </span>
      <Switch checked={checked} label={title} disabled={disabled} onChange={onChange} />
    </div>
  );
}

/** Telegram Bot 通知：开关、Bot 配置、通知类型与测试发送 */
export function TelegramBotNotificationSheet({
  open,
  settings,
  saving,
  t,
  onClose,
  onSave,
}: {
  open: boolean;
  settings: GlobalSettings;
  saving: boolean;
  t: T;
  onClose: () => void;
  onSave: (patch: GlobalSettings) => void;
}) {
  const [draft, setDraft] = useState<GlobalSettings>(settings);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setTestResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const patch = (values: Partial<GlobalSettings>) => setDraft((prev) => ({ ...prev, ...values }));
  const enabled = Boolean(draft.telegram_bot_notify_enabled);

  const handleTest = async () => {
    if (!draft.telegram_bot_token || !draft.telegram_bot_chat_id) {
      setTestResult({ ok: false, message: t("telegram_bot_test_required") });
      return;
    }
    const tokenStr = getToken();
    if (!tokenStr) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testTelegramBotNotification(tokenStr, {
        bot_token: draft.telegram_bot_token,
        chat_id: draft.telegram_bot_chat_id,
        message_thread_id: draft.telegram_bot_message_thread_id,
      });
      setTestResult({ ok: res.success, message: res.message });
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.message || String(err) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("telegram_bot_notify")}
      size="md"
      tall
      footer={
        <button
          type="button"
          className="btn btn-primary btn-lg w-full"
          disabled={saving}
          onClick={() => onSave({
            telegram_bot_notify_enabled: draft.telegram_bot_notify_enabled,
            telegram_bot_login_notify_enabled: draft.telegram_bot_login_notify_enabled,
            telegram_bot_task_failure_enabled: draft.telegram_bot_task_failure_enabled,
            telegram_bot_task_success_enabled: draft.telegram_bot_task_success_enabled,
            telegram_bot_token: draft.telegram_bot_token,
            telegram_bot_chat_id: draft.telegram_bot_chat_id,
            telegram_bot_message_thread_id: draft.telegram_bot_message_thread_id,
          })}
        >
          {saving ? <Spinner className="text-white" /> : null}
          {t("save")}
        </button>
      }
    >
      <div className="space-y-6 pt-1">
        <ListSection footer={t("telegram_bot_notify_desc")}>
          <SwitchRow
            title={t("telegram_bot_master_switch")}
            checked={enabled}
            onChange={(next) => patch({ telegram_bot_notify_enabled: next })}
          />
        </ListSection>

        <ListSection header={t("telegram_bot_section_bot")}>
          <FieldRow label={t("telegram_bot_token_short")} htmlFor="bot-token">
            <RowInput
              id="bot-token"
              type="password"
              autoComplete="off"
              className="mono"
              value={draft.telegram_bot_token || ""}
              onChange={(e) => patch({ telegram_bot_token: e.target.value || null })}
              placeholder={t("telegram_bot_token_placeholder")}
            />
          </FieldRow>
          <FieldRow label={t("telegram_bot_chat_id_short")} htmlFor="bot-chat">
            <RowInput
              id="bot-chat"
              inputMode="numeric"
              className="mono"
              value={draft.telegram_bot_chat_id || ""}
              onChange={(e) => patch({ telegram_bot_chat_id: e.target.value || null })}
              placeholder={t("telegram_bot_chat_id_placeholder")}
            />
          </FieldRow>
          <FieldRow label={t("topic_id_short")} htmlFor="bot-thread">
            <RowInput
              id="bot-thread"
              inputMode="numeric"
              className="mono"
              value={draft.telegram_bot_message_thread_id ?? ""}
              onChange={(e) => {
                const value = e.target.value.replace(/[^\d]/g, "");
                patch({ telegram_bot_message_thread_id: value ? parseInt(value, 10) : null });
              }}
              placeholder={t("optional")}
            />
          </FieldRow>
          <div className="list-row py-2">
            <button type="button" className="btn btn-sm btn-tinted" onClick={handleTest} disabled={testing}>
              {testing ? <Spinner className="h-3.5 w-3.5 border-[1.5px]" /> : null}
              {t("telegram_bot_send_test")}
            </button>
            {testResult ? (
              <span
                role="status"
                className={cn("min-w-0 flex-1 text-footnote", testResult.ok ? "text-success" : "text-danger")}
              >
                {testResult.message}
              </span>
            ) : null}
          </div>
        </ListSection>

        <ListSection
          header={t("telegram_bot_section_events")}
          footer={enabled ? undefined : t("telegram_bot_events_off_hint")}
        >
          <SwitchRow
            title={t("telegram_login_notify")}
            description={t("telegram_login_notify_desc")}
            checked={Boolean(draft.telegram_bot_login_notify_enabled)}
            disabled={!enabled}
            onChange={(next) => patch({ telegram_bot_login_notify_enabled: next })}
          />
          <SwitchRow
            title={t("telegram_task_failure_notify")}
            description={t("telegram_task_failure_notify_desc")}
            checked={draft.telegram_bot_task_failure_enabled !== false}
            disabled={!enabled}
            onChange={(next) => patch({ telegram_bot_task_failure_enabled: next })}
          />
          <SwitchRow
            title={t("telegram_task_success_notify")}
            description={t("telegram_task_success_notify_desc")}
            checked={Boolean(draft.telegram_bot_task_success_enabled)}
            disabled={!enabled}
            onChange={(next) => patch({ telegram_bot_task_success_enabled: next })}
          />
        </ListSection>
      </div>
    </Sheet>
  );
}
