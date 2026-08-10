"use client";

import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UnsavedBarProps {
    visible: boolean;
    saving: boolean;
    onSave: () => void;
    onReset: () => void;
    label?: string;
}

/**
 * Sticky bar that appears only when a tab holds unsaved changes.
 * One save action per tab — replaces the scattered per-card save buttons.
 */
export function UnsavedBar({ visible, saving, onSave, onReset, label }: UnsavedBarProps) {
    if (!visible) return null;

    return (
        <div className="sticky bottom-4 z-40 mt-6">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
                <span className="flex-1 text-sm font-medium text-slate-700">
                    {label ?? "Masz niezapisane zmiany"}
                </span>
                <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>
                    Odrzuć
                </Button>
                <Button variant="hero" size="sm" onClick={onSave} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Zapisywanie…" : "Zapisz zmiany"}
                </Button>
            </div>
        </div>
    );
}
