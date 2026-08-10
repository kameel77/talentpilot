"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CreditCard, Link2, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SettingsNavItem {
    href: string;
    label: string;
    description: string;
    icon: React.ElementType;
}

export const SETTINGS_NAV: SettingsNavItem[] = [
    {
        href: "/dashboard/settings/account",
        label: "Konto",
        description: "Dane logowania, kontakt, język, hasło",
        icon: User,
    },
    {
        href: "/dashboard/settings/billing",
        label: "Rozliczenia",
        description: "Plan, dane do faktury, płatności",
        icon: CreditCard,
    },
    {
        href: "/dashboard/settings/public-profile",
        label: "Moja wizytówka",
        description: "Publiczny link i widoczność danych",
        icon: Link2,
    },
    {
        href: "/dashboard/settings/organization",
        label: "Moja organizacja",
        description: "Dane firmy i użytkownicy",
        icon: Building2,
    },
];

export function SettingsNav({ items }: { items: SettingsNavItem[] }) {
    const pathname = usePathname();

    return (
        <nav aria-label="Sekcje ustawień">
            {/* Mobile: horizontal, scrollable tabs */}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
                {items.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href;
                    return (
                        <Link
                            key={href}
                            href={href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                                active
                                    ? "border-blue-200 bg-blue-50 text-blue-700"
                                    : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </Link>
                    );
                })}
            </div>

            {/* Desktop: left rail */}
            <div className="hidden lg:flex lg:flex-col lg:gap-1">
                {items.map(({ href, label, description, icon: Icon }) => {
                    const active = pathname === href;
                    return (
                        <Link
                            key={href}
                            href={href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors",
                                active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-blue-600" : "text-slate-400")} />
                            <span className="min-w-0">
                                <span className="block text-sm font-medium">{label}</span>
                                <span className="block text-xs text-muted-foreground">{description}</span>
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
