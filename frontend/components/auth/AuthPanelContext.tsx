"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AuthPanelRole = "coach" | "personal" | null;

interface AuthPanelContextValue {
    role: AuthPanelRole;
    setRole: (role: AuthPanelRole) => void;
}

const AuthPanelContext = createContext<AuthPanelContextValue | null>(null);

/**
 * Shares the currently selected registration role with the auth marketing
 * panel, without prop-drilling it through the (auth) layout. Only the
 * register page ever writes to this context; every other auth page simply
 * renders the default panel copy.
 */
export function AuthPanelProvider({ children }: { children: ReactNode }) {
    const [role, setRole] = useState<AuthPanelRole>(null);
    const value = useMemo(() => ({ role, setRole }), [role]);

    return <AuthPanelContext.Provider value={value}>{children}</AuthPanelContext.Provider>;
}

export function useAuthPanelRole() {
    const ctx = useContext(AuthPanelContext);
    if (!ctx) {
        throw new Error("useAuthPanelRole must be used within an AuthPanelProvider");
    }
    return ctx;
}
