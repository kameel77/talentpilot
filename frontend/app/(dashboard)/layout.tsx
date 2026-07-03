"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
    LayoutDashboard,
    Users,
    GitCompare,
    Zap,
    Settings,
    LogOut,
    Bell,
    Sparkles,
    Database,
    Shield,
    MessageSquare,
    Menu,
    X,
    ChevronDown,
    Building
} from "lucide-react";
import { tokenManager, User, api } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const t = useTranslations("nav");
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [orgMenuOpen, setOrgMenuOpen] = useState(false);
    const [organizations, setOrganizations] = useState<Array<{id: number, name: string}>>([]);
    const [activeOrgId, setActiveOrgId] = useState<number | null>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const orgMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setUserMenuOpen(false);
            }
            if (orgMenuRef.current && !orgMenuRef.current.contains(event.target as Node)) {
                setOrgMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const checkAuth = async () => {
            const token = tokenManager.getToken();
            if (!token) {
                router.push("/login");
                return;
            }

            const currentUser = tokenManager.getUser();
            setUser(currentUser);
            
            try {
                if (currentUser && (currentUser.role === 'coach' || currentUser.role === 'admin')) {
                    const orgs = await api.auth.getMyOrganizations();
                    setOrganizations(orgs);
                } else if (currentUser) {
                    setOrganizations([{id: currentUser.organization_id, name: t('myOrg')}]);
                }
                
                const savedOrgId = tokenManager.getActiveOrgId();
                if (savedOrgId) {
                    setActiveOrgId(savedOrgId);
                } else if (currentUser) {
                    setActiveOrgId(currentUser.organization_id);
                }
            } catch (error) {
                console.error("Failed to load organizations", error);
            }

            setLoading(false);
        };

        checkAuth();
    }, [router]);

    // Close sidebar on route change (mobile)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSidebarOpen(false);
    }, [pathname]);

    const handleLogout = () => {
        tokenManager.removeToken();
        router.push("/login");
    };

    const handleOrgChange = (orgId: number) => {
        tokenManager.setActiveOrgId(orgId);
        setActiveOrgId(orgId);
        setOrgMenuOpen(false);
        window.location.reload(); // Reload to refresh data
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

    const isCoach = user?.role === 'coach';

    const navigation = [
        { name: t("overview"), href: "/dashboard", icon: LayoutDashboard },
        // Self-as-member features are hidden for coaches — they work on clients, not on themselves
        ...(!isCoach ? [{ name: t("myTalents"), href: "/dashboard/my-talents", icon: Sparkles }] : []),
        { name: t("qa"), href: "/dashboard/qa", icon: MessageSquare },
        { name: t("teams"), href: "/dashboard/teams", icon: Users },
        { name: t("compare"), href: "/dashboard/compare", icon: GitCompare },
        { name: t("tips"), href: "/dashboard/tips", icon: Zap },
    ];

    const knowledgeLinks = [
        { name: t('knowledgeFaq'), href: "/dashboard/admin/knowledge/faq" },
        { name: t('knowledgeMerytoryka'), href: "/dashboard/admin/knowledge/merytoryka" },
        { name: t('knowledgeInstructions'), href: "/dashboard/admin/knowledge/instructions" },
    ];

    const adminNavigation = [
        { name: isCoach ? t("clients") : t("organizations"), href: "/dashboard/organizations", icon: Building },
        { name: t("adminSettings"), href: "/dashboard/admin/settings", icon: Shield },
        { name: t("adminUsers"), href: "/dashboard/admin/users", icon: Users },
    ];

    const sidebarContent = (
        <>
            <div className="p-5 flex items-center justify-between border-b border-white/5 h-16">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-600 flex items-center justify-center rounded-xl text-white font-bold text-xl">
                        TP
                    </div>
                    <span className="text-xl font-bold text-white tracking-tight">
                        TalentPilot
                    </span>
                </div>
                {/* Close button — only visible on mobile */}
                <button
                    onClick={() => setSidebarOpen(false)}
                    className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label={t('closeMenu')}
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <nav className="flex-1 px-4 mt-6 space-y-1 overflow-y-auto">
                <div className="space-y-1">
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
                </div>

                {(user?.role === 'admin' || user?.role === 'coach') && (
                    <div className="mt-8">
                        <h3 className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                            {t('administration')}
                        </h3>
                        <div className="space-y-3">
                            {user?.role === 'admin' && (
                                <div className="space-y-1">
                                    <Link
                                        href="/dashboard/admin/knowledge"
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium",
                                            pathname === "/dashboard/admin/knowledge"
                                                ? "bg-blue-600 text-white"
                                                : "text-slate-400 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <Database className={cn(
                                            "h-5 w-5",
                                            pathname === "/dashboard/admin/knowledge"
                                                ? "text-white"
                                                : "text-slate-500 group-hover:text-white"
                                        )} />
                                        {t("adminKnowledge")}
                                    </Link>
                                    <div className="ml-8 space-y-1">
                                        {knowledgeLinks.map((item) => {
                                            const isActive = pathname === item.href;
                                            return (
                                                <Link
                                                    key={item.name}
                                                    href={item.href}
                                                    className={cn(
                                                        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all",
                                                        isActive
                                                            ? "bg-white/10 text-white"
                                                            : "text-slate-400 hover:text-white hover:bg-white/5"
                                                    )}
                                                >
                                                    {item.name}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            <div className="space-y-1">
                                {adminNavigation.map((item) => {
                                    // Coach only sees Organizations
                                    if (user?.role === 'coach' && item.href !== '/dashboard/organizations') return null;
                                    
                                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
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
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* Settings/Logout moved to user dropdown */}
        </>
    );

    return (
        <div className="flex h-screen w-full bg-slate-50 font-sans overflow-hidden">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar — Desktop: always visible, Mobile: slide-in */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
                style={{ width: '256px', backgroundColor: '#111827', minWidth: '256px' }}
            >
                {sidebarContent}
            </aside>

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0 h-screen">
                {/* Header */}
                <header
                    style={{ height: '64px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' }}
                    className="flex-none px-4 sm:px-8 flex items-center justify-between z-20"
                >
                    <div className="flex items-center gap-4">
                        {/* Hamburger button — only on mobile */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            aria-label={t('openMenu')}
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <span className="font-bold text-slate-900 lg:hidden">TalentPilot</span>
                    </div>

                    <div className="flex items-center gap-4">
                        {(organizations.length > 1 || (isCoach && organizations.length >= 1)) && (
                            <div className="relative" ref={orgMenuRef}>
                                <button
                                    onClick={() => setOrgMenuOpen(!orgMenuOpen)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700"
                                >
                                    <Building className="h-4 w-4 text-slate-400" />
                                    <span className="max-w-[150px] truncate hidden sm:inline">
                                        {organizations.find(o => o.id === activeOrgId)?.name || (isCoach ? t('myWorkspace') : t('orgFallback'))}
                                    </span>
                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                </button>

                                {orgMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                                        <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                                            {t('availableOrgs')}
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto p-1">
                                            {organizations.map(org => (
                                                <button
                                                    key={org.id}
                                                    onClick={() => handleOrgChange(org.id)}
                                                    className={cn(
                                                        "flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                                                        activeOrgId === org.id
                                                            ? "bg-blue-50 text-blue-700 font-medium"
                                                            : "text-slate-700 hover:bg-slate-50"
                                                    )}
                                                >
                                                    <span className="truncate">{org.name}</span>
                                                    {activeOrgId === org.id && (
                                                        <span className="ml-auto flex h-2 w-2 rounded-full bg-blue-600"></span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <button className="relative p-2 text-slate-400 hover:text-slate-600">
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-2 right-2 h-2 w-2 bg-orange-500 border-2 border-white rounded-full" />
                        </button>

                        <div className="relative" ref={userMenuRef}>
                            <button
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="h-10 w-10 bg-blue-600 text-white flex items-center justify-center rounded-full font-bold text-sm hover:ring-2 hover:ring-blue-600/50 hover:ring-offset-2 transition-all focus:outline-none overflow-hidden"
                            >
                                {user?.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || "AK"
                                )}
                            </button>
                            
                            {userMenuOpen && (
                                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                                    <div className="px-4 py-3 border-b border-slate-100">
                                        <p className="text-sm font-medium text-slate-900 truncate">{user?.full_name}</p>
                                        <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                                    </div>
                                    <div className="p-1">
                                        <Link
                                            href="/dashboard/settings"
                                            onClick={() => setUserMenuOpen(false)}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors",
                                                pathname === "/dashboard/settings" && "bg-blue-50 text-blue-600"
                                            )}
                                        >
                                            <Settings className="h-4 w-4" />
                                            {t("settings")}
                                        </Link>
                                    </div>
                                    <div className="p-1 border-t border-slate-100">
                                        <button
                                            onClick={() => {
                                                setUserMenuOpen(false);
                                                handleLogout();
                                            }}
                                            className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            {t("logout")}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Content Area with its own scroll */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 bg-slate-50">
                    <div className="max-w-7xl mx-auto w-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
