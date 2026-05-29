"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { KPICard } from "@/components/ui/KPICard";
import {
    Users,
    Database,
    ArrowRightLeft,
    TrendingUp,
    ChevronRight,
    ArrowRight,
    Sparkles,
    Loader2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { api, tokenManager, DashboardOverview, User } from "@/lib/api";

interface DashboardData extends DashboardOverview {
    currentUser: User | null;
}

export default function DashboardPage() {
    const t = useTranslations("dashboard");
    const tCommon = useTranslations("common");

    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const overview = await api.dashboard.overview();
                setData({
                    ...overview,
                    currentUser: tokenManager.getUser(),
                });
            } catch {
                setError(t("loadError"));
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [t]);

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-slate-500">{tCommon("loading")}</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-8 py-6 text-center">
                    <p className="text-sm font-medium text-rose-700">{error}</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { currentUser, team_domains: teamDomains, users_with_talents: usersWithTalents, total_users: totalUsers, members } = data;
    const totalTalents = teamDomains.executing + teamDomains.influencing + teamDomains.relationship_building + teamDomains.strategic_thinking;
    const totalDomains = totalTalents || 1; // Avoid division by zero

    const domainPercentages = {
        executing: Math.round((teamDomains.executing / totalDomains) * 100),
        influencing: Math.round((teamDomains.influencing / totalDomains) * 100),
        relationship_building: Math.round((teamDomains.relationship_building / totalDomains) * 100),
        strategic_thinking: Math.round((teamDomains.strategic_thinking / totalDomains) * 100),
    };

    const firstName = currentUser?.full_name?.split(" ")[0];

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">{t("title")}</h1>
                    <p className="mt-1 text-slate-500 font-medium">
                        {firstName ? t("greeting", { name: firstName }) : t("greetingFallback")} {t("overview")}
                    </p>
                </div>
                <Link
                    href="/dashboard/users"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/25 hover:bg-primary-dark transition-all group"
                >
                    {t("manageTeam")}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <KPICard
                    title={t("teamMembers")}
                    value={totalUsers}
                    icon={<Users className="h-5 w-5" />}
                    description={t("activeUsers")}
                />
                <KPICard
                    title={t("importedTalents")}
                    value={totalTalents}
                    icon={<Database className="h-5 w-5" />}
                    description={`${usersWithTalents} ${t("talentProfiles")}`}
                />
                <KPICard
                    title={t("compare")}
                    value="—"
                    icon={<ArrowRightLeft className="h-5 w-5" />}
                    description={t("comingSoon")}
                />
                <KPICard
                    title={t("talentCoverage")}
                    value={totalUsers > 0 ? `${Math.round((usersWithTalents / totalUsers) * 100)}%` : "0%"}
                    icon={<TrendingUp className="h-5 w-5" />}
                    description={`${usersWithTalents} ${t("coverageOf")} ${totalUsers} ${t("users")}`}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Domain Area */}
                <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/60 p-6 sm:p-8 shadow-sm">
                    <h3 className="text-xl font-bold font-heading text-slate-900 mb-6 tracking-tight">
                        {t("talentDistribution")}
                    </h3>

                    {totalTalents === 0 ? (
                        <div className="text-center py-8">
                            <Database className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                            <p className="text-sm text-slate-500">
                                {t("noTalentsEmpty")}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-6">
                                <DomainProgress label={t("domains.executing")} value={domainPercentages.executing} color="bg-domain-executing" />
                                <DomainProgress label={t("domains.influencing")} value={domainPercentages.influencing} color="bg-domain-influencing" />
                                <DomainProgress label={t("domains.relationship_building")} value={domainPercentages.relationship_building} color="bg-domain-relationship" />
                                <DomainProgress label={t("domains.strategic_thinking")} value={domainPercentages.strategic_thinking} color="bg-domain-strategic" />
                            </div>

                            <div className="mt-8 flex gap-3">
                                <div className="h-10 bg-domain-executing rounded-xl" style={{ flex: teamDomains.executing || 0.1 }} />
                                <div className="h-10 bg-domain-influencing rounded-xl" style={{ flex: teamDomains.influencing || 0.1 }} />
                                <div className="h-10 bg-domain-relationship rounded-xl" style={{ flex: teamDomains.relationship_building || 0.1 }} />
                                <div className="h-10 bg-domain-strategic rounded-xl" style={{ flex: teamDomains.strategic_thinking || 0.1 }} />
                            </div>
                        </>
                    )}
                </div>

                {/* Daily Tip Area */}
                <div className="lg:col-span-8 bg-blue-50/50 rounded-3xl border border-blue-100/50 p-6 sm:p-8 flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm ring-1 ring-blue-100">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                                    Q&A Copilot
                                </span>
                            </div>
                            <h4 className="text-xl font-bold text-slate-900 font-heading tracking-tight">
                                {t("askAboutTeam")}
                            </h4>
                        </div>
                    </div>

                    <p className="text-lg text-slate-600 leading-relaxed max-w-2xl">
                        {t("aiCopilotHint")}
                    </p>

                    <div className="mt-auto pt-8">
                        <Link
                            href="/dashboard/qa"
                            className="flex items-center gap-2 text-sm font-bold text-slate-900 hover:gap-3 transition-all"
                        >
                            {t("openQA")}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Team Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">{t("yourTeam")}</h3>
                    <Link href="/dashboard/users" className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
                        {t("viewAll")}
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                </div>

                {totalUsers === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-12 sm:p-16 text-center">
                        <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <h4 className="text-lg font-semibold text-slate-700">{t("noMembers")}</h4>
                        <p className="mt-2 text-sm text-slate-500">
                            {t("inviteMembers")}
                        </p>
                        <Link
                            href="/dashboard/users"
                            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-sm"
                        >
                            {t("addUser")}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {members.map((member) => (
                            <MemberCard
                                key={member.id}
                                id={member.id}
                                name={member.full_name}
                                role={roleLabel(member.role, t)}
                                email={member.email}
                                initials={getInitials(member.full_name)}
                                activeLabel={t("active")}
                                viewProfileLabel={t("viewProfile")}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function DomainProgress({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-700">{label}</span>
                <span className="text-slate-400 font-medium">{value}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${value}%` }} />
            </div>
        </div>
    );
}

function MemberCard({ id, name, role, email, initials, activeLabel, viewProfileLabel }: { id: number; name: string; role: string; email: string; initials: string; activeLabel: string; viewProfileLabel: string }) {
    return (
        <Link
            href={`/dashboard/users/${id}`}
            className="group bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
            <div className="flex items-center gap-4 mb-4">
                <div className="h-14 w-14 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-xl relative shrink-0">
                    {initials}
                </div>
                <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 group-hover:text-primary transition-colors truncate">{name}</h4>
                    <p className="text-xs text-slate-500 font-medium">{role}</p>
                    <p className="text-xs text-slate-400 truncate">{email}</p>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">{activeLabel}</span>
                </div>
                <span className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    {viewProfileLabel}
                    <ChevronRight className="h-3 w-3" />
                </span>
            </div>
        </Link>
    );
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function roleLabel(role: string, t: (key: string) => string): string {
    switch (role) {
        case "admin":
            return t("roleAdmin");
        case "manager":
            return t("roleManager");
        default:
            return t("roleUser");
    }
}
