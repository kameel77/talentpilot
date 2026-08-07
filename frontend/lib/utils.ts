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
