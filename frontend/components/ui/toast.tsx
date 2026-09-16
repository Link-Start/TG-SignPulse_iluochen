"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, Info, WarningCircle } from "@phosphor-icons/react";

export type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const DURATION_MS = 4000;
const EXIT_MS = 220;

const ICONS = {
  success: <CheckCircle weight="fill" size={22} className="text-success-dot" aria-hidden />,
  error: <WarningCircle weight="fill" size={22} className="text-danger-dot" aria-hidden />,
  info: <Info weight="fill" size={22} className="text-accent-text" aria-hidden />,
};

function Toast({ toast, onClose }: { toast: ToastItem; onClose: (id: string) => void }) {
  const [leaving, setLeaving] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      setLeaving(true);
      exitTimer = setTimeout(() => onCloseRef.current(toast.id), EXIT_MS);
    }, toast.type === "error" ? DURATION_MS + 1500 : DURATION_MS);
    return () => {
      clearTimeout(timer);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [toast.id, toast.type]);

  const dismiss = () => {
    setLeaving(true);
    setTimeout(() => onCloseRef.current(toast.id), EXIT_MS);
  };

  return (
    <button
      type="button"
      onClick={dismiss}
      role={toast.type === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full items-start gap-2.5 rounded-2xl bg-surface px-4 py-3 text-left shadow-float ring-1 ring-black/5 transition-[opacity,transform] duration-200 ease-out dark:bg-[#1f262e] dark:ring-white/10"
      style={{
        animation: "toast-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        opacity: leaving ? 0 : 1,
        transform: leaving ? "translateY(-8px) scale(0.98)" : undefined,
      }}
    >
      <span className="mt-px">{ICONS[toast.type]}</span>
      <span className="min-w-0 flex-1 break-words text-subhead text-label">{toast.message}</span>
    </button>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seqRef = useRef(0);

  const addToast = useCallback((message: string, type: ToastType = "success") => {
    seqRef.current += 1;
    const id = `${Date.now()}-${seqRef.current}`;
    // 同一时间最多保留 3 条，避免挡住页面
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(() => ({ addToast }), [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[90] mx-auto flex w-full max-w-[440px] flex-col gap-2 px-4 pt-[calc(var(--safe-t)+10px)] lg:pt-[72px]"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
