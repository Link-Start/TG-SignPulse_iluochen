import { cn } from "../../lib/utils";

/** 产品图标：色区上的半透明圆角方块 + 一条脉冲线 */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-grid flex-none place-items-center bg-white/20", className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.29) }}
    >
      <svg width={Math.round(size * 0.64)} height={Math.round(size * 0.64)} viewBox="0 0 24 24">
        <path
          d="M3 12.5h4l2.2-5 3.6 10 2.4-6.5 1.3 1.5H21"
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
