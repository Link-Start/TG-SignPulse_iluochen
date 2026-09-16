"use client";

import { ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { useFocusTrap, usePresence, useScrollLock } from "../../lib/hooks";
import { useLanguage } from "../../context/LanguageContext";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  /** 固定在底部的操作区 */
  footer?: ReactNode;
  /** 标题右侧、关闭按钮左侧的附加操作 */
  headerAction?: ReactNode;
  /** 桌面端的最大宽度 */
  size?: "sm" | "md" | "lg" | "xl";
  /** 移动端撑到接近全屏（日志、长表单） */
  tall?: boolean;
  dismissible?: boolean;
  bodyClassName?: string;
}

const WIDTHS = {
  sm: "sm:max-w-[420px]",
  md: "sm:max-w-[540px]",
  lg: "sm:max-w-[680px]",
  xl: "sm:max-w-[880px]",
};

const EXIT_MS = 320;

/**
 * 手机上是从底部滑出的抽屉（可下拉关闭），≥640px 时是居中的对话框。
 * 关闭动画期间保留最后一次打开时的内容，调用方可以在 onClose 里直接清空数据。
 */
export function Sheet(props: SheetProps) {
  const { open } = props;
  const { t } = useLanguage();
  const snapshot = useRef(props);
  if (open) snapshot.current = props;
  const view = open ? props : snapshot.current;
  const {
    title,
    subtitle,
    children,
    footer,
    headerAction,
    size = "md",
    tall = false,
    dismissible = true,
    bodyClassName,
  } = view;

  const { mounted, visible } = usePresence(open, EXIT_MS);
  const panelRef = useFocusTrap<HTMLDivElement>(open && mounted);
  const titleId = useId();
  useScrollLock(open);

  const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;

  useEffect(() => {
    if (!open || !dismissible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, dismissible]);

  // 下拉关闭：只在抽屉形态（窄屏）下生效
  const dragRef = useRef<{ startY: number; dy: number; startedAt: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dismissible || !window.matchMedia("(max-width: 639px)").matches) return;
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    const panel = panelRef.current;
    if (!panel) return;
    dragRef.current = { startY: event.clientY, dy: 0, startedAt: performance.now() };
    event.currentTarget.setPointerCapture(event.pointerId);
    panel.style.transition = "none";
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel) return;
    const dy = event.clientY - drag.startY;
    // 向上拖动加阻尼，向下跟手
    drag.dy = dy > 0 ? dy : dy / 6;
    panel.style.transform = `translateY(${drag.dy}px)`;
  };

  const onPointerEnd = () => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    dragRef.current = null;
    if (!drag || !panel) return;
    panel.style.transition = "";
    panel.style.transform = "";
    const velocity = drag.dy / Math.max(1, performance.now() - drag.startedAt);
    if (drag.dy > 110 || (drag.dy > 24 && velocity > 0.5)) {
      onCloseRef.current();
    }
  };

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <div
        aria-hidden
        onClick={dismissible ? props.onClose : undefined}
        className={cn(
          "absolute inset-0 bg-[var(--scrim)] transition-opacity duration-300 ease-out",
          visible ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          "sheet-panel relative flex w-full flex-col bg-sheet shadow-float outline-none",
          "max-h-[calc(100dvh-var(--safe-t)-10px)] rounded-t-sheet",
          "transition-[transform,opacity] duration-[420ms] ease-sheet",
          "sm:max-h-[min(86dvh,860px)] sm:rounded-sheet sm:duration-300 sm:ease-out-expo",
          WIDTHS[size],
          tall && "h-[calc(100dvh-var(--safe-t)-10px)] sm:h-[min(86dvh,860px)]",
          visible
            ? "translate-y-0 sm:scale-100 sm:opacity-100"
            : "translate-y-full sm:translate-y-0 sm:scale-[0.97] sm:opacity-0"
        )}
      >
        <div
          className="shrink-0 touch-none select-none sm:touch-auto sm:select-auto"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <div className="flex justify-center pt-[5px] sm:hidden" aria-hidden>
            <span className="h-[5px] w-9 rounded-full bg-fill-strong" />
          </div>
          {(title || dismissible || headerAction) && (
            <div className="flex min-h-[52px] items-center gap-2 px-4 pb-2 pt-2 sm:pt-4">
              <div className="min-w-0 flex-1">
                {title ? (
                  <h2 id={titleId} className="truncate text-title3">
                    {title}
                  </h2>
                ) : null}
                {subtitle ? (
                  <div className="mt-0.5 truncate text-footnote text-label-2">{subtitle}</div>
                ) : null}
              </div>
              {headerAction}
              {dismissible ? (
                <button
                  type="button"
                  onClick={props.onClose}
                  aria-label={t("close")}
                  className="icon-btn bg-fill text-label-2"
                >
                  <X size={15} weight="bold" />
                </button>
              ) : null}
            </div>
          )}
        </div>
        <div
          className={cn(
            "scroll-contain min-h-0 flex-1 overflow-y-auto px-4 pb-4",
            !footer && "pb-[calc(var(--safe-b)+16px)] sm:pb-5",
            bodyClassName
          )}
        >
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 px-4 pb-[calc(var(--safe-b)+12px)] pt-3 hairline-top sm:pb-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
