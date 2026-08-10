"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface ToggleRowProps {
    label: string;
    description?: string;
    checked: boolean;
    /** Persists the new value. Rejecting rolls the switch back. */
    onChange: (next: boolean) => Promise<void>;
    disabled?: boolean;
    className?: string;
}

/**
 * A switch that saves immediately (optimistic, with rollback on failure).
 * Toggles never participate in the tab's "unsaved changes" bar — mixing the two
 * was the main source of confusion on the old settings screen.
 */
export function ToggleRow({ label, description, checked, onChange, disabled, className }: ToggleRowProps) {
    const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

    const handleChange = async (next: boolean) => {
        setState("saving");
        try {
            await onChange(next);
            setState("saved");
            setTimeout(() => setState("idle"), 1500);
        } catch {
            setState("idle");
        }
    };

    return (
        <div className={cn("flex items-center justify-between gap-3 py-1.5", className)}>
            <div className="min-w-0">
                <p className="text-sm text-slate-700">{label}</p>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <span className="w-4">
                    {state === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                    {state === "saved" && <Check className="h-3.5 w-3.5 text-green-600" />}
                </span>
                <Switch checked={checked} onCheckedChange={handleChange} disabled={disabled || state === "saving"} />
            </div>
        </div>
    );
}
