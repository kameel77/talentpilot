"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Check, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error";

interface ToastItem {
    id: number;
    variant: ToastVariant;
    text: string;
    /** Optional inline action, e.g. "Cofnij" for optimistic toggles. */
    action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
    toast: (text: string, variant?: ToastVariant, action?: ToastItem["action"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);

    const dismiss = useCallback((id: number) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    }, []);

    const toast = useCallback<ToastContextValue["toast"]>((text, variant = "success", action) => {
        const id = Date.now() + Math.random();
        setItems((prev) => [...prev.slice(-2), { id, variant, text, action }]);
    }, []);

    const value = useMemo(() => ({ toast }), [toast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-6 sm:translate-x-0">
                {items.map((item) => (
                    <ToastRow key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    const isError = item.variant === "error";

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                "pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200",
                isError
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-slate-200 bg-white text-slate-800"
            )}
        >
            {isError ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            ) : (
                <Check className="h-4 w-4 shrink-0 text-green-600" />
            )}
            <span className="flex-1 text-sm">{item.text}</span>
            {item.action && (
                <button
                    onClick={() => {
                        item.action!.onClick();
                        onDismiss();
                    }}
                    className="shrink-0 text-sm font-medium text-blue-600 hover:underline"
                >
                    {item.action.label}
                </button>
            )}
            <button
                onClick={onDismiss}
                aria-label="Zamknij powiadomienie"
                className="shrink-0 text-slate-400 transition-colors hover:text-slate-600"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return ctx;
}
