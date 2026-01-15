"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard,
    Users,
    GitCompare,
    Zap,
    Settings,
    LogOut,
    Bell,
    ChevronLeft,
    Menu
} from "lucide-react";
import { tokenManager, User } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const checkAuth = () => {
            const token = tokenManager.getToken();
            if (!token) {
                router.push("/login");
                return;
            }

            const currentUser = tokenManager.getUser();
            setUser(currentUser);
            setLoading(false);
        };

        checkAuth();
    }, [router]);

    const handleLogout = () => {
        tokenManager.removeToken();
        router.push("/login");
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-10 w-10 bg-primary/20 rounded-full" />
                    <div className="text-slate-400 font-medium tracking-wide">TalentPilot...</div>
                </div>
            </div>
        );
    }

    const navigation = [
        { name: "Panel główny", href: "/dashboard", icon: LayoutDashboard },
        { name: "Zespół", href: "/dashboard/users", icon: Users },
        { name: "Porównanie 1:1", href: "/dashboard/compare", icon: GitCompare },
        { name: "Dzienna wskazówka", href: "/dashboard/tips", icon: Zap },
    ];

    return (
        <div className="flex h-screen w-full bg-slate-50 font-sans overflow-hidden">
            {/* Sidebar Desktop */}
            <aside
                style={{ width: '256px', backgroundColor: '#111827', minWidth: '256px' }}
                className="flex-none flex flex-col z-30 border-r border-white/10"
            >
                <div className="p-6 flex items-center justify-between border-b border-white/5 h-16">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-600 flex items-center justify-center rounded-xl text-white font-bold text-xl">
                            TP
                        </div>
                        <span className="text-xl font-bold text-white tracking-tight">
                            TalentPilot
                        </span>
                    </div>
                </div>

                <nav className="flex-1 px-4 mt-6 space-y-1 overflow-y-auto">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium",
                                    isActive
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <item.icon className={cn(
                                    "h-5 w-5",
                                    isActive ? "text-white" : "text-slate-500 group-hover:text-white"
                                )} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-white/5 space-y-1 mt-auto">
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5">
                        <Settings className="h-5 w-5" />
                        Ustawienia
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5"
                    >
                        <LogOut className="h-5 w-5" />
                        Wyloguj się
                    </button>
                </div>
            </aside>

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0 h-screen">
                {/* Header */}
                <header
                    style={{ height: '64px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' }}
                    className="flex-none px-8 flex items-center justify-between z-20"
                >
                    <div className="flex items-center gap-4">
                        <span className="font-bold text-slate-900 md:hidden">TalentPilot</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="relative p-2 text-slate-400 hover:text-slate-600">
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-2 right-2 h-2 w-2 bg-orange-500 border-2 border-white rounded-full" />
                        </button>

                        <div className="h-10 w-10 bg-blue-600 text-white flex items-center justify-center rounded-full font-bold text-sm">
                            {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || "AK"}
                        </div>
                    </div>
                </header>

                {/* Content Area with its own scroll */}
                <main className="flex-1 overflow-y-auto p-8 bg-slate-50">
                    <div className="max-w-7xl mx-auto w-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
