"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import { useFocusTrap, useMediaQuery, usePresence, useScrollLock } from "../../lib/hooks";
import { useLanguage } from "../../context/LanguageContext";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/**
 * 替代原生 confirm()：手机上是底部操作表，宽屏是居中提示框。
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const lastRef = useRef<PendingConfirm | null>(null);
  if (pending) lastRef.current = pending;
  const view = pending ?? lastRef.current;
  const open = Boolean(pending);
  const { mounted, visible } = usePresence(open, 260);
  const panelRef = useFocusTrap<HTMLDivElement>(open && mounted);
  const isWide = useMediaQuery("(min-width: 640px)");
  const titleId = useId();
  useScrollLock(open);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending((prev) => {
          prev?.resolve(false);
          return { ...options, resolve };
        });
      }),
    []
  );

  const settle = useCallback((value: boolean) => {
    setPending((prev) => {
      prev?.resolve(value);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        settle(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, settle]);

  const confirmText = view?.confirmText || t("confirm");
  const cancelText = view?.cancelText || t("cancel");
  const confirmTone = view?.destructive ? "text-danger" : "text-accent-text";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {mounted && view && typeof document !== "undefined"
        ? createPortal(
            <div
              className={cn(
                "fixed inset-0 z-[80] flex justify-center",
                isWide ? "items-center p-6" : "items-end px-2 pb-[calc(var(--safe-b)+8px)]"
              )}
            >
              <div
                aria-hidden
                onClick={() => settle(false)}
                className={cn(
                  "absolute inset-0 bg-[var(--scrim)] transition-opacity duration-200 ease-out",
                  visible ? "opacity-100" : "opacity-0"
                )}
              />
              <div
                ref={panelRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={cn(
                  "sheet-panel relative w-full outline-none transition-[transform,opacity] ease-out-expo",
                  isWide
                    ? cn("max-w-[300px] duration-200", visible ? "scale-100 opacity-100" : "scale-[1.08] opacity-0")
                    : cn("max-w-[480px] duration-[360ms]", visible ? "translate-y-0" : "translate-y-[110%]")
                )}
              >
                {isWide ? (
                  <div className="overflow-hidden rounded-[14px] bg-surface text-center shadow-float">
                    <div className="px-4 pb-4 pt-5">
                      <h2 id={titleId} className="text-headline">
                        {view.title}
                      </h2>
                      {view.message ? (
                        <p className="mt-1 whitespace-pre-line text-footnote text-label-2">{view.message}</p>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 hairline-top">
                      <button
                        type="button"
                        onClick={() => settle(false)}
                        className="list-row min-h-[44px] justify-center text-center text-body text-accent-text"
                      >
                        {cancelText}
                      </button>
                      <button
                        type="button"
                        onClick={() => settle(true)}
                        className={cn(
                          "list-row min-h-[44px] justify-center border-l border-separator text-center text-body font-semibold",
                          confirmTone
                        )}
                      >
                        {confirmText}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="overflow-hidden rounded-[14px] bg-surface text-center">
                      <div className="px-5 pb-3.5 pt-4">
                        <h2 id={titleId} className="text-footnote font-semibold text-label-2">
                          {view.title}
                        </h2>
                        {view.message ? (
                          <p className="mt-1 whitespace-pre-line text-footnote text-label-2">{view.message}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => settle(true)}
                        className={cn(
                          "list-row min-h-[56px] justify-center text-center text-[20px] leading-[25px] hairline-top",
                          confirmTone
                        )}
                      >
                        {confirmText}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => settle(false)}
                      className="list-row min-h-[56px] justify-center rounded-[14px] text-center text-[20px] font-semibold leading-[25px] text-accent-text"
                    >
                      {cancelText}
                    </button>
                  </div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (context === undefined) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
}
