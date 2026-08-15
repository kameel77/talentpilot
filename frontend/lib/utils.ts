import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function isPlaceholderEmail(email?: string | null): boolean {
    if (!email) return false;
    const parts = email.split("@");
    if (parts.length === 2) {
        const domain = parts[1].toLowerCase();
        return domain === "placeholder.talentpilot.local" || domain.endsWith(".placeholder.talentpilot.local");
    }
    return false;
}

export interface PlanLimitDetails {
    code: 'plan_limit_exceeded';
    resource: 'client_orgs' | 'profiles';
    limit?: number;
    current?: number;
    plan?: string;
}

export function getPlanLimitDetails(err: unknown): PlanLimitDetails | null {
    if (!err || typeof err !== 'object') return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axiosErr = err as any;
    const detail = axiosErr?.response?.data?.detail;
    if (detail && typeof detail === 'object' && detail.code === 'plan_limit_exceeded') {
        return detail as PlanLimitDetails;
    }
    return null;
}

export function getApiErrorMessage(err: unknown, fallback: string = "Wystąpił nieoczekiwany błąd."): string {
    if (!err) return fallback;
    if (typeof err === "string") return err;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorObj = err as any;
    const detail = errorObj?.response?.data?.detail;

    if (typeof detail === "string") {
        return detail;
    }

    if (Array.isArray(detail)) {
        const messages = detail
            .map((item) => {
                if (typeof item === "string") return item;
                if (item && typeof item === "object" && typeof item.msg === "string") {
                    return item.msg.replace(/^Value error,\s*/, "");
                }
                return null;
            })
            .filter(Boolean);
        if (messages.length > 0) return messages.join(", ");
    }

    if (detail && typeof detail === "object") {
        if (typeof detail.message === "string") {
            return detail.message;
        }
        if (detail.code === "plan_limit_exceeded") {
            const resourceLabel = detail.resource === "profiles" ? "profili osób" : "organizacji";
            const limitStr = typeof detail.limit === "number" ? ` (limit: ${detail.limit})` : "";
            return `Osiągnięto limit ${resourceLabel}${limitStr} w Twoim planie.`;
        }
    }

    if (typeof errorObj.message === "string") {
        return errorObj.message;
    }

    return fallback;
}

