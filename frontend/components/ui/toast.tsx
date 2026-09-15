"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ToastProps {
    message: string;
    type?: "success" | "error" | "info";
    duration?: number;
    onClose: () => void;
}

export function Toast({ message, type = "info", duration = 4000, onClose }: ToastProps) {
    const [isExiting, setIsExiting] = useState(false);
    // onClose 通常是父组件内联函数，放进依赖会让父组件每次渲染都重置计时，
    // 父组件频繁刷新（如倒计时）时 toast 永远不会自动消失
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        let exitTimer: ReturnType<typeof setTimeout> | undefined;
        const timer = setTimeout(() => {
            setIsExiting(true);
            exitTimer = setTimeout(() => onCloseRef.current(), 300);
        }, duration);

        return () => {
            clearTimeout(timer);
            if (exitTimer) clearTimeout(exitTimer);
        };
    }, [duration]);

    const getIcon = () => {
        switch (type) {
            case "success":
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                );
            case "error":
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                );
            default:
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                );
        }
    };

    const getColors = () => {
        switch (type) {
            case "success":
                return "from-emerald-500/20 to-cyan-500/20 border-emerald-500/30 text-emerald-300";
            case "error":
                return "from-red-500/20 to-pink-500/20 border-red-500/30 text-red-300";
            default:
                return "from-blue-500/20 to-purple-500/20 border-blue-500/30 text-blue-300";
        }
    };

    const getIconBg = () => {
        switch (type) {
            case "success":
                return "bg-emerald-500/20";
            case "error":
                return "bg-red-500/20";
            default:
                return "bg-blue-500/20";
        }
    };

    return (
        <div
            className={`
        ${isExiting ? "toast-exit" : "toast-enter"}
        flex items-center gap-3 px-4 py-3 rounded-xl
        bg-gradient-to-r ${getColors()}
        backdrop-blur-xl border
        shadow-lg shadow-black/20
        min-w-[280px] max-w-[400px]
      `}
        >
            <div className={`p-2 rounded-lg ${getIconBg()}`}>
                {getIcon()}
            </div>
            <p className="text-sm font-medium text-white/90 flex-1">{message}</p>
            <button
                onClick={() => {
                    setIsExiting(true);
                    setTimeout(onClose, 300);
                }}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white/80"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}

interface ToastContainerProps {
    toasts: Array<{ id: string; message: string; type: "success" | "error" | "info" }>;
    removeToast: (id: string) => void;
}

export function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
    return (
        <div className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-3">
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    onClose={() => removeToast(toast.id)}
                />
            ))}
        </div>
    );
}

// Hook for managing toasts
let toastSeq = 0;

export function useToast() {
    const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: "success" | "error" | "info" }>>([]);

    // 保持引用稳定：页面里大量 useCallback / useEffect 依赖 addToast，
    // 每次渲染换新函数会让依赖它的轮询 effect 反复重启
    const addToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
        // 同一毫秒内连续弹出时 Date.now() 会重复，导致 key 冲突、关闭一个误删多个
        toastSeq += 1;
        const id = `${Date.now()}-${toastSeq}`;
        setToasts((prev) => [...prev, { id, message, type }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    return { toasts, addToast, removeToast };
}
