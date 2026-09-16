"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChatCircleText,
  MagnifyingGlass,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import { getToken } from "../../../../lib/auth";
import {
  createSignTask,
  getAccountChats,
  getSignTask,
  listAccounts,
  searchAccountChats,
  testRunChat,
  updateSignTask,
  AccountInfo,
  ChatInfo,
  SignTaskChat,
} from "../../../../lib/api";
import { cn, fmt } from "../../../../lib/utils";
import { formatError } from "../../../../lib/tasks";
import { useLanguage } from "../../../../context/LanguageContext";
import { useToast } from "../../../../components/ui/toast";
import { useConfirm } from "../../../../components/ui/confirm";
import { NavBar } from "../../../../components/ui/page-header";
import { Sheet } from "../../../../components/ui/sheet";
import { EmptyState, Segmented, Spinner, Switch } from "../../../../components/ui/controls";
import { FieldRow, ListRow, ListSection, RowInput, RowSelect, RowTimeInput } from "../../../../components/ui/list";

type T = (key: string) => string;

const DICE_OPTIONS = ["🎲", "🎯", "🏀", "⚽", "🎳", "🎰"];

const ACTION_TYPES = [
  { value: 1, labelKey: "action_send_text" },
  { value: 2, labelKey: "action_send_dice" },
  { value: 3, labelKey: "action_click_button" },
  { value: 4, labelKey: "action_ai_vision_click" },
  { value: 5, labelKey: "action_ai_logic_send" },
  { value: 6, labelKey: "action_ai_vision_send" },
  { value: 7, labelKey: "action_ai_logic_click" },
  { value: 8, labelKey: "keyword_monitor" },
];

const CRON_EXAMPLES = ["0 9 * * *", "30 8 * * 1-5"];

const defaultActionData = (actionType: number): any => {
  switch (actionType) {
    case 2: return { action: 2, dice: "🎲" };
    case 3: return { action: 3, text: "" };
    case 4: return { action: 4, question: "" };
    case 5: return { action: 5 };
    case 6: return { action: 6 };
    case 7: return { action: 7 };
    case 8: return { action: 8, keywords: [], match_mode: "contains", ignore_case: true, push_channel: "telegram" };
    default: return { action: 1, text: "" };
  }
};

type EditingChat = SignTaskChat;

const emptyChat = (): EditingChat => ({
  chat_id: 0,
  name: "",
  message_thread_id: undefined,
  actions: [],
  action_interval: 1,
});

// ── 动作编辑 ─────────────────────────────────────────────────────────

/** 关键词输入：保留原始文本，换行或逗号分隔 */
function KeywordsField({ id, value, onChange, placeholder }: { id: string; value: string[]; onChange: (keywords: string[]) => void; placeholder: string }) {
  const [raw, setRaw] = useState(() => value.join("\n"));
  const lastParsed = useRef(value.join("\n"));

  useEffect(() => {
    const joined = value.join("\n");
    if (joined !== lastParsed.current) {
      lastParsed.current = joined;
      setRaw(joined);
    }
  }, [value]);

  return (
    <textarea
      id={id}
      rows={3}
      className="text-field bg-fill"
      placeholder={placeholder}
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        const keywords = e.target.value.split(/[\n,]/).map((k) => k.trim()).filter(Boolean);
        lastParsed.current = keywords.join("\n");
        onChange(keywords);
      }}
    />
  );
}

function ActionCard({
  index,
  action,
  t,
  onChange,
  onRemove,
}: {
  index: number;
  action: any;
  t: T;
  onChange: (next: any) => void;
  onRemove: () => void;
}) {
  const idBase = `action-${index}`;
  const patch = (values: Record<string, any>) => onChange({ ...action, ...values });

  return (
    <div className="group-list">
      <div className="list-row py-0 pr-2">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-fill text-footnote font-semibold text-label-2 num">
          {index + 1}
        </span>
        <RowSelect
          aria-label={fmt(t("action_type_label"), { index: index + 1 })}
          value={action.action}
          onChange={(e) => onChange(defaultActionData(parseInt(e.target.value, 10)))}
          className="font-semibold"
        >
          {ACTION_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {t(type.labelKey)}
            </option>
          ))}
        </RowSelect>
        <button
          type="button"
          onClick={onRemove}
          aria-label={fmt(t("remove_action"), { index: index + 1 })}
          className="icon-btn text-danger"
        >
          <X size={18} weight="bold" aria-hidden />
        </button>
      </div>

      {(action.action === 1 || action.action === 3) && (
        <FieldRow label={action.action === 1 ? t("field_message") : t("field_button_text")} htmlFor={`${idBase}-text`}>
          <RowInput
            id={`${idBase}-text`}
            value={action.text || ""}
            placeholder={action.action === 1 ? t("placeholder_msg") : t("placeholder_btn")}
            onChange={(e) => patch({ text: e.target.value })}
          />
        </FieldRow>
      )}

      {action.action === 2 && (
        <div className="list-row flex-wrap gap-2">
          {DICE_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-pressed={action.dice === emoji}
              onClick={() => patch({ dice: emoji })}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl text-[22px] transition-[background-color,box-shadow] duration-150",
                action.dice === emoji ? "bg-accent-soft ring-2 ring-accent" : "bg-fill"
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {[4, 5, 6, 7].includes(action.action) && (
        <p className="list-row text-footnote text-label-2">{t(`ai_hint_${action.action}`)}</p>
      )}

      {action.action === 4 && (
        <FieldRow stacked label={t("ai_vision_question_label")} htmlFor={`${idBase}-question`}>
          <input
            id={`${idBase}-question`}
            className="text-field bg-fill"
            value={action.question || ""}
            placeholder={t("ai_vision_question_placeholder")}
            onChange={(e) => patch({ question: e.target.value })}
          />
        </FieldRow>
      )}

      {action.action === 8 && (
        <>
          <FieldRow stacked label={t("monitor_keywords")} htmlFor={`${idBase}-keywords`}>
            <KeywordsField
              id={`${idBase}-keywords`}
              value={action.keywords || []}
              placeholder={t("monitor_keywords_placeholder")}
              onChange={(keywords) => patch({ keywords })}
            />
          </FieldRow>
          <FieldRow label={t("match_mode")} htmlFor={`${idBase}-match`}>
            <RowSelect
              id={`${idBase}-match`}
              value={action.match_mode || "contains"}
              onChange={(e) => patch({ match_mode: e.target.value })}
            >
              <option value="contains">{t("match_contains")}</option>
              <option value="exact">{t("match_exact")}</option>
              <option value="regex">{t("match_regex")}</option>
            </RowSelect>
          </FieldRow>
          <div className="list-row">
            <span className="flex-1 text-body">{t("ignore_case")}</span>
            <Switch
              checked={action.ignore_case !== false}
              label={t("ignore_case")}
              onChange={(next) => patch({ ignore_case: next })}
            />
          </div>
          <FieldRow label={t("push_channel")} htmlFor={`${idBase}-push`}>
            <RowSelect
              id={`${idBase}-push`}
              value={action.push_channel || "telegram"}
              onChange={(e) => patch({ push_channel: e.target.value })}
            >
              <option value="telegram">{t("push_telegram")}</option>
              <option value="forward">{t("push_forward")}</option>
              <option value="bark">{t("push_bark")}</option>
              <option value="custom">{t("push_custom")}</option>
              <option value="continue">{t("push_continue")}</option>
            </RowSelect>
          </FieldRow>
          {action.push_channel === "bark" && (
            <FieldRow stacked label={t("bark_url_label")} htmlFor={`${idBase}-bark`}>
              <input
                id={`${idBase}-bark`}
                type="url"
                inputMode="url"
                autoCapitalize="off"
                spellCheck={false}
                className="text-field bg-fill mono"
                placeholder="https://api.day.app/yourkey/"
                value={action.bark_url || ""}
                onChange={(e) => patch({ bark_url: e.target.value })}
              />
            </FieldRow>
          )}
          {action.push_channel === "custom" && (
            <FieldRow stacked label={t("custom_push_url")} htmlFor={`${idBase}-custom`}>
              <input
                id={`${idBase}-custom`}
                type="url"
                inputMode="url"
                autoCapitalize="off"
                spellCheck={false}
                className="text-field bg-fill mono"
                placeholder={t("custom_push_url_placeholder")}
                value={action.custom_url || ""}
                onChange={(e) => patch({ custom_url: e.target.value })}
              />
            </FieldRow>
          )}
          {action.push_channel === "forward" && (
            <FieldRow label={t("forward_chat_id_label")} htmlFor={`${idBase}-forward`}>
              <RowInput
                id={`${idBase}-forward`}
                inputMode="numeric"
                className="mono"
                placeholder="-1001234567890"
                value={action.forward_chat_id || ""}
                onChange={(e) => patch({ forward_chat_id: e.target.value })}
              />
            </FieldRow>
          )}
          {action.push_channel === "continue" && (
            <FieldRow label={t("continue_chat_id_label")} htmlFor={`${idBase}-continue`}>
              <RowInput
                id={`${idBase}-continue`}
                inputMode="numeric"
                className="mono"
                placeholder="-1001234567890"
                value={action.continue_chat_id || ""}
                onChange={(e) => patch({ continue_chat_id: e.target.value })}
              />
            </FieldRow>
          )}
        </>
      )}
    </div>
  );
}

// ── 目标聊天编辑 ─────────────────────────────────────────────────────

function ChatEditorSheet({
  chat,
  isNew,
  token,
  account,
  availableChats,
  t,
  onChange,
  onSave,
  onRemove,
  onClose,
  onSessionInvalid,
}: {
  chat: EditingChat | null;
  isNew: boolean;
  token: string | null;
  account: string;
  availableChats: ChatInfo[];
  t: T;
  onChange: (chat: EditingChat) => void;
  onSave: () => void;
  onRemove: () => void;
  onClose: () => void;
  onSessionInvalid: (err: any) => boolean;
}) {
  const { addToast } = useToast();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ChatInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const open = Boolean(chat);

  const latest = useRef({ addToast, t, onSessionInvalid });
  latest.current = { addToast, t, onSessionInvalid };

  useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
      setSearching(false);
    }
  }, [open]);

  useEffect(() => {
    if (!token || !account) return;
    const query = search.trim();
    if (!query) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchAccountChats(token, account, query, 50, 0);
        if (!cancelled) setResults(res.items || []);
      } catch (err: any) {
        if (cancelled) return;
        if (latest.current.onSessionInvalid(err)) return;
        latest.current.addToast(formatError(latest.current.t, "search_failed", err), "error");
        setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, token, account]);

  const pickChat = (info: ChatInfo) => {
    if (!chat) return;
    onChange({ ...chat, chat_id: info.id, name: info.title || info.username || String(info.id) });
    setSearch("");
    setResults([]);
  };

  const setActions = (actions: any[]) => chat && onChange({ ...chat, actions });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isNew ? t("configure_target_chat") : t("edit_chat_btn")}
      size="md"
      tall
      footer={
        <button type="button" className="btn btn-primary btn-lg w-full" onClick={onSave}>
          {isNew ? t("confirm_add") : t("done")}
        </button>
      }
    >
      {chat ? (
        <div className="space-y-6 pt-1">
          <ListSection header={t("select_target_chat")} footer={t("chat_search_hint")}>
            <div className="list-row py-2">
              <label className="relative block w-full">
                <span className="sr-only">{t("search_chat")}</span>
                <MagnifyingGlass
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-label-2"
                  aria-hidden
                />
                <input
                  type="search"
                  className="text-field bg-fill min-h-[38px] py-2 pl-9"
                  placeholder={t("search_chat_placeholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            {search.trim() ? (
              searching ? (
                <div className="list-row text-subhead text-label-2">
                  <Spinner className="h-4 w-4" />
                  {t("searching")}
                </div>
              ) : results.length > 0 ? (
                results.map((info) => (
                  <ListRow
                    key={info.id}
                    onClick={() => pickChat(info)}
                    title={<span className="block truncate">{info.title || info.username || String(info.id)}</span>}
                    subtitle={
                      <span className="block truncate font-mono text-[12px]">
                        {info.id}
                        {info.username ? ` · @${info.username}` : ""}
                      </span>
                    }
                  />
                ))
              ) : (
                <div className="list-row text-subhead text-label-2">{t("search_no_results")}</div>
              )
            ) : (
              <FieldRow label={t("field_chat")} htmlFor="chat-select">
                <RowSelect
                  id="chat-select"
                  value={chat.chat_id}
                  onChange={(e) => {
                    const cid = parseInt(e.target.value, 10);
                    const info = availableChats.find((c) => c.id === cid);
                    onChange({ ...chat, chat_id: cid, name: info?.title || info?.username || "" });
                  }}
                >
                  <option value={0}>{t("select_chat_placeholder")}</option>
                  {/* 通过搜索选中、但不在最近聊天里的目标 */}
                  {chat.chat_id !== 0 && !availableChats.some((c) => c.id === chat.chat_id) ? (
                    <option value={chat.chat_id}>{chat.name || chat.chat_id}</option>
                  ) : null}
                  {availableChats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title || c.username}
                    </option>
                  ))}
                </RowSelect>
              </FieldRow>
            )}
            {chat.chat_id !== 0 ? (
              <ListRow title={t("id_label")} value={<span className="font-mono text-subhead">{chat.chat_id}</span>} />
            ) : null}
            <FieldRow label={t("topic_id_short")} htmlFor="chat-topic">
              <RowInput
                id="chat-topic"
                inputMode="numeric"
                placeholder={t("optional")}
                value={chat.message_thread_id ?? ""}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d]/g, "");
                  onChange({ ...chat, message_thread_id: value ? parseInt(value, 10) : undefined });
                }}
              />
            </FieldRow>
          </ListSection>

          <section>
            <div className="group-header flex items-end justify-between">
              <span>{fmt(t("action_sequence_count"), { count: chat.actions.length })}</span>
            </div>
            <div className="space-y-3">
              {chat.actions.map((action, index) => (
                <ActionCard
                  key={index}
                  index={index}
                  action={action}
                  t={t}
                  onChange={(next) => {
                    const actions = [...chat.actions];
                    actions[index] = next;
                    setActions(actions);
                  }}
                  onRemove={() => setActions(chat.actions.filter((_, i) => i !== index))}
                />
              ))}
              <div className="group-list">
                <ListRow
                  icon={<Plus size={20} weight="bold" className="text-accent-text" />}
                  title={t("add_sign_action")}
                  tone="accent"
                  onClick={() => setActions([...chat.actions, { action: 1, text: "" }])}
                />
              </div>
            </div>
            <p className="group-footer">{t("action_sequence_hint")}</p>
          </section>

          {!isNew ? (
            <ListSection>
              <ListRow
                icon={<Trash size={22} className="text-danger" />}
                title={t("remove_chat")}
                tone="danger"
                onClick={onRemove}
              />
            </ListSection>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

// ── 页面 ─────────────────────────────────────────────────────────────

function CreateSignTaskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editName = searchParams.get("edit") || "";
  const presetAccount = searchParams.get("account") || "";
  const isEditing = Boolean(editName);

  const { t } = useLanguage();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [token] = useState<string | null>(() => getToken());
  const [saving, setSaving] = useState(false);
  const [loadingTask, setLoadingTask] = useState(isEditing);

  const [taskName, setTaskName] = useState("");
  const [executionMode, setExecutionMode] = useState<"fixed" | "range">("range");
  const [signAt, setSignAt] = useState("0 6 * * *");
  const [rangeStart, setRangeStart] = useState("09:00");
  const [rangeEnd, setRangeEnd] = useState("18:00");
  const [randomSeconds, setRandomSeconds] = useState(0);
  const [signInterval, setSignInterval] = useState(1);
  const [chats, setChats] = useState<SignTaskChat[]>([]);

  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [availableChats, setAvailableChats] = useState<ChatInfo[]>([]);
  const [testingChatIdx, setTestingChatIdx] = useState<number | null>(null);
  const [nameInvalid, setNameInvalid] = useState(false);

  const [editingChatIndex, setEditingChatIndex] = useState<number | null>(null);
  const [editingChat, setEditingChat] = useState<EditingChat | null>(null);

  // 回调通过 ref 读取最新值，初始化 effect 只跑一次
  const latest = useRef({ addToast, t, router });
  latest.current = { addToast, t, router };

  const handleAccountSessionInvalid = useCallback((err: any) => {
    if (err?.code !== "ACCOUNT_SESSION_INVALID") return false;
    latest.current.addToast(latest.current.t("account_session_invalid"), "error");
    setTimeout(() => latest.current.router.replace("/dashboard"), 800);
    return true;
  }, []);

  const loadChats = useCallback(
    async (tokenStr: string, accountName: string) => {
      try {
        setAvailableChats(await getAccountChats(tokenStr, accountName));
      } catch (err: any) {
        if (handleAccountSessionInvalid(err)) return;
        console.error("加载 Chat 失败:", err);
      }
    },
    [handleAccountSessionInvalid]
  );

  useEffect(() => {
    if (!token) return;
    const { addToast: toast, t: tr } = latest.current;

    const loadAccountList = async () => {
      try {
        const data = await listAccounts(token);
        setAccounts(data.accounts);
        if (isEditing) return;
        const preset = data.accounts.find((acc) => acc.name === presetAccount);
        // 默认选第一个登录有效的账号
        const firstValid = data.accounts.find((acc) => !acc.needs_relogin) || data.accounts[0];
        const account = preset?.name || firstValid?.name || "";
        if (account) {
          setSelectedAccount(account);
          loadChats(token, account);
        }
      } catch (err: any) {
        toast(formatError(tr, "load_failed", err), "error");
      }
    };

    const loadExistingTask = async () => {
      try {
        const task = await getSignTask(token, editName, presetAccount);
        setTaskName(task.name);
        setSelectedAccount(task.account_name);
        setExecutionMode(task.execution_mode || "range");
        setSignAt(task.sign_at || "0 6 * * *");
        setRangeStart(task.range_start || "09:00");
        setRangeEnd(task.range_end || "18:00");
        setRandomSeconds(task.random_seconds || 0);
        setSignInterval(task.sign_interval || 1);
        setChats(task.chats || []);
        await loadChats(token, task.account_name);
      } catch (err: any) {
        toast(formatError(tr, "load_failed", err), "error");
      } finally {
        setLoadingTask(false);
      }
    };

    loadAccountList();
    if (isEditing) loadExistingTask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAccountChange = (accountName: string) => {
    setSelectedAccount(accountName);
    setAvailableChats([]);
    if (token) loadChats(token, accountName);
  };

  const openAddChat = () => {
    setEditingChatIndex(null);
    setEditingChat(emptyChat());
  };

  const openEditChat = (idx: number) => {
    setEditingChatIndex(idx);
    setEditingChat({ ...chats[idx], actions: [...chats[idx].actions] });
  };

  const closeChatEditor = () => {
    setEditingChat(null);
    setEditingChatIndex(null);
  };

  const handleSaveChat = () => {
    if (!editingChat) return;
    if (editingChat.chat_id === 0) {
      addToast(t("select_chat_error"), "error");
      return;
    }
    if (editingChat.actions.length === 0) {
      addToast(t("add_action_error"), "error");
      return;
    }
    const firstActionType = editingChat.actions[0]?.action;
    if (firstActionType !== 1 && firstActionType !== 2) {
      addToast(t("first_action_must_be_send"), "error");
      return;
    }
    if (editingChatIndex !== null) {
      setChats((prev) => prev.map((item, i) => (i === editingChatIndex ? editingChat : item)));
    } else {
      setChats((prev) => [...prev, editingChat]);
    }
    closeChatEditor();
  };

  const handleRemoveChat = async () => {
    if (editingChatIndex === null || !editingChat) return;
    const ok = await confirm({
      title: fmt(t("remove_chat_title"), { name: editingChat.name || editingChat.chat_id }),
      confirmText: t("remove_chat"),
      destructive: true,
    });
    if (!ok) return;
    const index = editingChatIndex;
    setChats((prev) => prev.filter((_, i) => i !== index));
    closeChatEditor();
  };

  const handleTestChat = async (idx: number) => {
    if (!token) return;
    setTestingChatIdx(idx);
    const chat = chats[idx];
    try {
      const res = await testRunChat(token, selectedAccount, {
        chat_id: chat.chat_id,
        name: chat.name,
        actions: chat.actions,
        action_interval: chat.action_interval,
        message_thread_id: chat.message_thread_id,
        delete_after: chat.delete_after,
      });
      if (res.success) {
        addToast(t("test_chat_success"), "success");
      } else {
        addToast(`${t("test_chat_failed")}: ${res.message}`, "error");
      }
    } catch (err: any) {
      if (handleAccountSessionInvalid(err)) return;
      addToast(formatError(t, "test_chat_failed", err), "error");
    } finally {
      setTestingChatIdx(null);
    }
  };

  const handleSubmit = async () => {
    if (!token || saving) return;
    if (!isEditing && !taskName.trim()) {
      setNameInvalid(true);
      addToast(t("task_name_required"), "error");
      return;
    }
    if (!isEditing && !selectedAccount) {
      addToast(t("account_required"), "error");
      return;
    }
    if (executionMode === "fixed" && !signAt.trim()) {
      addToast(t("cron_required"), "error");
      return;
    }
    if (executionMode === "range" && (!rangeStart || !rangeEnd)) {
      addToast(t("range_required"), "error");
      return;
    }
    if (chats.length === 0) {
      addToast(t("chat_required"), "error");
      return;
    }

    const schedule = {
      sign_at: executionMode === "fixed" ? signAt.trim() : "0 0 * * *",
      chats,
      random_seconds: randomSeconds,
      sign_interval: signInterval,
      execution_mode: executionMode,
      range_start: rangeStart,
      range_end: rangeEnd,
    };

    setSaving(true);
    try {
      if (isEditing) {
        await updateSignTask(token, editName, schedule, presetAccount);
        addToast(t("save_success"), "success");
      } else {
        await createSignTask(token, { name: taskName.trim(), account_name: selectedAccount, ...schedule });
        addToast(t("create_success"), "success");
      }
      router.push("/dashboard");
    } catch (err: any) {
      addToast(formatError(t, isEditing ? "save_failed" : "create_failed", err), "error");
      setSaving(false);
    }
  };

  const title = isEditing ? t("edit_task") : t("add_task");

  const modeSwitch = (
    <div className="list-divider relative px-4 pb-3 pt-1.5">
      <Segmented<"fixed" | "range">
        value={executionMode}
        onChange={setExecutionMode}
        label={t("scheduling_mode")}
        options={[
          { value: "range", label: t("mode_range") },
          { value: "fixed", label: t("mode_fixed") },
        ]}
      />
    </div>
  );
  const submitLabel = isEditing ? t("save_changes") : t("deploy_task");

  return (
    <>
      <NavBar
        title={title}
        backHref="/dashboard"
        backLabel={t("tab_tasks")}
        trailing={
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || loadingTask}
            className="field-btn field-btn-solid has-label hidden lg:inline-flex"
          >
            {saving ? <Spinner className="h-4 w-4" /> : null}
            {submitLabel}
          </button>
        }
      />

      {loadingTask ? (
        <div className="flex justify-center py-24">
          <Spinner className="h-7 w-7 text-label-2" label={t("loading")} />
        </div>
      ) : (
        <form
          className="page-body relative z-[1] pb-[calc(96px+var(--safe-b))] pt-4 lg:-mt-9 lg:pb-0 lg:pt-0"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
            <div className="space-y-5">
              <ListSection title={t("basic_config")} footer={isEditing ? t("edit_locked_hint") : undefined}>
                {isEditing ? (
                  <>
                    <ListRow title={t("task_name")} value={taskName} />
                    <ListRow title={t("associated_account")} value={selectedAccount} />
                  </>
                ) : (
                  <>
                    <FieldRow label={t("task_name")} htmlFor="task-name">
                      <RowInput
                        id="task-name"
                        autoComplete="off"
                        value={taskName}
                        aria-invalid={nameInvalid || undefined}
                        className={cn(nameInvalid && "placeholder:text-danger")}
                        onChange={(e) => {
                          setTaskName(e.target.value);
                          if (nameInvalid) setNameInvalid(false);
                        }}
                        placeholder={t("task_name_placeholder")}
                      />
                    </FieldRow>
                    <FieldRow label={t("associated_account")} htmlFor="task-account">
                      {accounts.length > 0 ? (
                        <RowSelect
                          id="task-account"
                          value={selectedAccount}
                          onChange={(e) => handleAccountChange(e.target.value)}
                        >
                          {accounts.map((acc) => (
                            <option key={acc.name} value={acc.name}>
                              {acc.name}
                            </option>
                          ))}
                        </RowSelect>
                      ) : (
                        <span className="text-body text-label-2">{t("no_account_yet")}</span>
                      )}
                    </FieldRow>
                  </>
                )}
              </ListSection>

              <section>
                {executionMode === "range" ? (
                  <ListSection title={t("scheduling_mode")} footer={t("random_range_desc")}>
                    {modeSwitch}
                    <FieldRow label={t("start_time")} htmlFor="range-start">
                      <RowTimeInput id="range-start" value={rangeStart} onChange={setRangeStart} />
                    </FieldRow>
                    <FieldRow label={t("end_time")} htmlFor="range-end">
                      <RowTimeInput id="range-end" value={rangeEnd} onChange={setRangeEnd} />
                    </FieldRow>
                  </ListSection>
                ) : (
                  <ListSection title={t("scheduling_mode")} footer={t("fixed_cron_desc")}>
                    {modeSwitch}
                    <FieldRow
                      stacked
                      label={t("cron_expression")}
                      htmlFor="cron"
                      hint={t("cron_fields_hint")}
                    >
                      <input
                        id="cron"
                        className="text-field bg-fill mono"
                        value={signAt}
                        onChange={(e) => setSignAt(e.target.value)}
                        placeholder={t("cron_placeholder")}
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </FieldRow>
                    <div className="list-row flex-wrap gap-2 py-2.5">
                      <span className="text-footnote text-label-2">{t("cron_examples")}</span>
                      {CRON_EXAMPLES.map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => setSignAt(example)}
                          className="chip bg-accent-soft font-mono text-accent-text"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </ListSection>
                )}
              </section>
            </div>

            <section>
              <div className="group-list">
                <h2 className="px-4 pb-1 pt-3.5 text-[13px] font-semibold leading-[18px] text-label-2">
                  {fmt(t("target_chats_count"), { count: chats.length })}
                </h2>
                {chats.length === 0 ? (
                  <EmptyState
                    icon={<ChatCircleText size={36} />}
                    title={t("no_target_chat")}
                    description={t("no_target_chat_desc")}
                    className="py-8"
                  />
                ) : (
                  chats.map((chat, idx) => (
                    <div
                      key={`${chat.chat_id}-${idx}`}
                      className="list-row gap-2 py-0 pr-3"
                      style={{ "--divider-inset": "56px" } as React.CSSProperties}
                    >
                      <button
                        type="button"
                        onClick={() => openEditChat(idx)}
                        className="list-row-press -ml-4 flex min-w-0 flex-1 items-center gap-3 self-stretch py-2.5 pl-4 text-left"
                      >
                        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-fill text-footnote font-semibold text-label-2 num">
                          {idx + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body">{chat.name || String(chat.chat_id)}</span>
                          <span className="mt-0.5 block truncate text-footnote text-label-2 num">
                            {fmt(t("chat_row_meta"), { count: chat.actions.length })}
                            {chat.message_thread_id ? ` · ${t("topic_id_short")} ${chat.message_thread_id}` : ""}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTestChat(idx)}
                        disabled={testingChatIdx !== null || !selectedAccount}
                        aria-label={fmt(t("test_chat_named"), { name: chat.name || chat.chat_id })}
                        className="btn btn-sm btn-tinted flex-none"
                      >
                        {testingChatIdx === idx ? <Spinner className="h-3.5 w-3.5 border-[1.5px]" /> : null}
                        {t("test_short")}
                      </button>
                    </div>
                  ))
                )}
                <ListRow
                  icon={<Plus size={20} weight="bold" className="text-accent-text" />}
                  title={t("add_chat")}
                  tone="accent"
                  onClick={openAddChat}
                  disabled={!selectedAccount}
                />
              </div>
              <p className="group-footer">{t("target_chats_hint")}</p>
            </section>
          </div>

          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      )}

      {/* 手机底部固定操作栏 */}
      {!loadingTask ? (
        <div className="material hairline-top fixed inset-x-0 bottom-0 z-30 px-safe pb-[calc(var(--safe-b)+10px)] pt-2.5 lg:hidden">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary btn-lg mx-auto w-full max-w-[560px]"
          >
            {saving ? <Spinner className="text-white" /> : null}
            {submitLabel}
          </button>
        </div>
      ) : null}

      <ChatEditorSheet
        chat={editingChat}
        isNew={editingChatIndex === null}
        token={token}
        account={selectedAccount}
        availableChats={availableChats}
        t={t}
        onChange={setEditingChat}
        onSave={handleSaveChat}
        onRemove={handleRemoveChat}
        onClose={closeChatEditor}
        onSessionInvalid={handleAccountSessionInvalid}
      />
    </>
  );
}

export default function CreateSignTaskPage() {
  return (
    <Suspense fallback={null}>
      <CreateSignTaskContent />
    </Suspense>
  );
}
