"use client";

import { ReactNode, forwardRef } from "react";
import Link from "next/link";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

/** 分组：可选的组标题 + 白色圆角容器 + 可选的组说明；title 放在卡片里面 */
export function ListSection({
  header,
  title,
  footer,
  children,
  className,
  listClassName,
  id,
}: {
  header?: ReactNode;
  title?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  listClassName?: string;
  id?: string;
}) {
  return (
    <section className={cn("min-w-0", className)} id={id}>
      {header ? <div className="group-header">{header}</div> : null}
      <div className={cn("group-list", listClassName)}>
        {title ? <h2 className="px-4 pb-1 pt-3.5 text-[13px] font-semibold leading-[18px] text-label-2">{title}</h2> : null}
        {children}
      </div>
      {footer ? <div className="group-footer">{footer}</div> : null}
    </section>
  );
}

interface RowContentProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  accessory?: ReactNode;
  chevron?: boolean;
  tone?: "default" | "accent" | "danger";
}

function RowContent({ icon, title, subtitle, value, accessory, chevron, tone = "default" }: RowContentProps) {
  return (
    <>
      {icon ? <span className="flex w-7 flex-none justify-center">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-body",
            tone === "accent" && "text-accent-text",
            tone === "danger" && "text-danger"
          )}
        >
          {title}
        </span>
        {subtitle ? <span className="mt-0.5 block text-footnote text-label-2">{subtitle}</span> : null}
      </span>
      {value !== undefined && value !== null ? (
        <span className="min-w-0 max-w-[55%] flex-none truncate text-right text-body text-label-2">{value}</span>
      ) : null}
      {accessory}
      {chevron ? <CaretRight size={14} weight="bold" className="row-chevron" aria-hidden /> : null}
    </>
  );
}

type RowProps = RowContentProps & {
  onClick?: () => void;
  href?: string;
  external?: boolean;
  disabled?: boolean;
  className?: string;
  /** 有图标时分隔线从文字处开始 */
  inset?: boolean;
};

/** 普通行：传 onClick 渲染为按钮，传 href 渲染为链接，否则为静态行 */
export function ListRow({ onClick, href, external, disabled, className, inset, ...content }: RowProps) {
  const style = content.icon || inset ? ({ "--divider-inset": "56px" } as React.CSSProperties) : undefined;
  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noreferrer" className={cn("list-row", className)} style={style}>
          <RowContent {...content} />
        </a>
      );
    }
    return (
      <Link href={href} className={cn("list-row", className)} style={style}>
        <RowContent {...content} />
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={cn("list-row", className)} style={style}>
        <RowContent {...content} />
      </button>
    );
  }
  return (
    <div className={cn("list-row", className)} style={style}>
      <RowContent {...content} />
    </div>
  );
}

/** 表单行：左侧标签 + 右侧输入控件 */
export function FieldRow({
  label,
  htmlFor,
  children,
  className,
  stacked,
  hint,
}: {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  /** 标签在上、控件在下（长输入、多行文本） */
  stacked?: boolean;
  hint?: ReactNode;
}) {
  if (stacked) {
    return (
      <div className={cn("list-row flex-col items-stretch gap-1.5 py-3", className)}>
        <label htmlFor={htmlFor} className="text-footnote text-label-2">
          {label}
        </label>
        {children}
        {hint ? <p className="text-footnote text-label-2">{hint}</p> : null}
      </div>
    );
  }
  return (
    <div className={cn("list-row py-0", className)}>
      <label htmlFor={htmlFor} className="w-[5.5em] max-w-[42%] flex-none text-body">
        {label}
      </label>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

/** 行内输入框，默认右对齐 */
export const RowInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { align?: "left" | "right" }>(
  function RowInput({ className, align = "left", ...props }, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={cn("field-input", align === "left" && "text-left", className)}
      />
    );
  }
);

/**
 * 行内时间选择：统一显示 24 小时制（原生控件会跟随浏览器区域显示 AM/PM），
 * 透明的原生 input 盖在上面，手机上点按仍弹出系统时间选择器。
 */
export function RowTimeInput({
  value,
  onChange,
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <span className={cn("relative flex h-11 flex-1 items-center justify-end", className)}>
      <span aria-hidden className="text-body num">
        {value || "--:--"}
      </span>
      <input
        {...props}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {
            // 部分浏览器不允许在此时打开选择器，忽略即可
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  );
}

/** 行内下拉选择，带展开箭头 */
export function RowSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="select-wrap w-full min-w-0 flex-1">
      <select {...props} className={cn("field-input h-11 w-full text-left", className)}>
        {children}
      </select>
      <CaretDown size={13} weight="bold" aria-hidden />
    </span>
  );
}

export function SectionTitle({ children, action, className, id }: { children: ReactNode; action?: ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn("flex min-h-[32px] items-end justify-between gap-3 px-1 pb-2", className)}>
      <h2 id={id} className="min-w-0 truncate text-title3">
        {children}
      </h2>
      {action}
    </div>
  );
}
