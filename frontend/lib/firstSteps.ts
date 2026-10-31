import { useSyncExternalStore } from "react";
import { tokenManager } from "@/lib/api";

/**
 * Browser-side signals for the coach "First steps" checklist — actions the
 * backend does not record (yet). Keyed per user so a shared browser does not
 * mix coaches. Replace with funnel analytics events once P4 lands
 * (docs/BRIEF_COACH_CLIENT_FLOW.md §6).
 */
export type FirstStepFlag = "link_copied" | "dismissed";

const EVENT = "tp:first-steps";

function storageKey(flag: FirstStepFlag): string | null {
    const userId = tokenManager.getUser()?.id;
    return userId ? `tp:first-steps:${flag}:${userId}` : null;
}

function readFlag(flag: FirstStepFlag): boolean {
    if (typeof window === "undefined") return false;
    const key = storageKey(flag);
    return key ? window.localStorage.getItem(key) === "1" : false;
}

export function setFirstStepFlag(flag: FirstStepFlag): void {
    if (typeof window === "undefined") return;
    const key = storageKey(flag);
    if (!key || window.localStorage.getItem(key) === "1") return;
    window.localStorage.setItem(key, "1");
    window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
        window.removeEventListener(EVENT, onChange);
        window.removeEventListener("storage", onChange);
    };
}

export function useFirstStepFlag(flag: FirstStepFlag): boolean {
    return useSyncExternalStore(subscribe, () => readFlag(flag), () => false);
}
