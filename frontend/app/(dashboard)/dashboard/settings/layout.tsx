"use client";

import { useMemo } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { SETTINGS_NAV, SettingsNav } from "@/components/settings/SettingsNav";
import { useRoleLabels } from "@/hooks/useRoleLabels";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const { role } = useRoleLabels();

    const items = useMemo(() => {
        // Billing belongs to whoever owns the workspace; regular members never
        // see invoice data. Hidden, not disabled. Hidden until the role is known,
        // so the tab appears rather than disappearing after hydration.
        const canSeeBilling = role === "admin" || role === "manager" || role === "coach";
        return SETTINGS_NAV.filter((item) => canSeeBilling || !item.href.endsWith("/billing"));
    }, [role]);

    return (
        <ToastProvider>
            <div className="w-full space-y-6">
                <div>
                    <h1 className="text-headline">Ustawienia</h1>
                    <p className="text-body">Zarządzaj kontem, rozliczeniami, wizytówką i organizacją</p>
                </div>

                <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
                    <aside className="mb-4 lg:mb-0">
                        <div className="lg:sticky lg:top-6">
                            <SettingsNav items={items} />
                        </div>
                    </aside>
                    <div className="min-w-0">{children}</div>
                </div>
            </div>
        </ToastProvider>
    );
}
