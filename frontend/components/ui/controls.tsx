"use client";

import { ReactNode } from "react";
import { cn } from "../../lib/utils";

/** iOS 开关：51×31，开启为强调色 */
export function Switch({
  checked,
  onChange,
  disabled,
  loading,
  label,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[31px] w-[51px] flex-none items-center rounded-full p-[2px] transition-colors duration-200 ease-out",
        "before:absolute before:-inset-[7px] before:content-['']",
        checked ? "bg-accent" : "bg-[var(--switch-off)]",
        (disabled || loading) && "opacity-50",
        className
      )}
    >
      <span
        className={cn(
          "flex h-[27px] w-[27px] items-center justify-center rounded-full bg-white shadow-thumb transition-transform duration-300 ease-out-expo",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      >
        {loading ? <span className="spinner h-3.5 w-3.5 border-[1.5px] text-accent" /> : null}
      </span>
    </button>
  );
}

/** 分段控件 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  label,
}: {
  value: T;
  options: { value: NoInfer<T>; label: ReactNode }[];
  onChange: (value: T) => void;
  className?: string;
  label?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  return (
    <div role="group" aria-label={label} className={cn("segmented", className)}>
      <span
        aria-hidden
        className="segmented-thumb"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return <span role={label ? "status" : undefined} aria-label={label} className={cn("spinner", className)} />;
}

/** 空状态与错误状态：图标 + 标题 + 说明 + 可选操作 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {icon ? <div className="mb-3 text-label-3">{icon}</div> : null}
      <h3 className="text-title3">{title}</h3>
      {description ? <p className="mt-1.5 max-w-[34ch] text-subhead text-label-2">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
