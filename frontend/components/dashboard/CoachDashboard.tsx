"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { KPICard } from "@/components/ui/KPICard";
import {
    Briefcase,
    Users,
    UsersRound,
    TrendingUp,
    ArrowRight,
    Sparkles,
    Loader2,
    UserRound,
    Building,
    ChevronRight,
} from "lucide-react";
import { api, tokenManager, CoachDashboardOverview, CoachClientOverview, User } from "@/lib/api";

export default function CoachDashboard() {
    const t = useTranslations("dashboard");
    const tCoach = useTranslations("dashboard.coach");
    const tCommon = useTranslations("common");
    const tOnboarding = useTranslations("onboarding");

    const [data, setData] = useState<CoachDashboardOverview | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        setUser(tokenManager.getUser());
        (async () => {
            try {
                setData(await api.dashboard.coachOverview());
            } catch {
                setError(t("loadError"));
            } finally {
                setLoading(false);
            }
        })();
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

    const firstName = user?.full_name?.split(" ")[0];
    const { clients, individual_clients, individual_clients_with_talents, totals } = data;
    const hasAnyClients = clients.length > 0 || individual_clients > 0;
    const coveragePct = totals.people > 0
        ? Math.round((totals.users_with_talents / totals.people) * 100)
        : 0;

    const openClient = (orgId: number) => {
        tokenManager.setActiveOrgId(orgId);
        window.location.assign("/dashboard/teams");
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">
                        {tCoach("title")}
                    </h1>
                    <p className="mt-1 text-slate-500 font-medium">
                        {firstName ? t("greeting", { name: firstName }) : t("greetingFallback")} {tCoach("subtitle")}
                    </p>
                </div>
                <Link
                    href="/dashboard/organizations"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/25 hover:bg-primary-dark transition-all group"
                >
                    {tCoach("manageClients")}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>

            {/* Onboarding banner — coach with no clients at all */}
            {!hasAnyClients && (
                <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-6 py-4">
                    <p className="text-sm font-medium text-blue-800">{tOnboarding("coach.resumeBanner")}</p>
                    <Link href="/dashboard/onboarding" className="text-sm font-bold text-blue-700 hover:underline">
                        {tOnboarding("coach.resumeCta")} →
                    </Link>
                </div>
            )}

            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <KPICard
                    title={tCoach("kpiClients")}
                    value={totals.clients}
                    icon={<Briefcase className="h-5 w-5" />}
                    description={tCoach("kpiClientsDesc", { count: individual_clients })}
                />
                <KPICard
                    title={tCoach("kpiTeams")}
                    value={totals.teams}
                    icon={<Users className="h-5 w-5" />}
                    description={tCoach("kpiTeamsDesc")}
                />
                <KPICard
                    title={tCoach("kpiPeople")}
                    value={totals.people}
                    icon={<UsersRound className="h-5 w-5" />}
                    description={tCoach("kpiPeopleDesc")}
                />
                <KPICard
                    title={tCoach("kpiCoverage")}
                    value={`${coveragePct}%`}
                    icon={<TrendingUp className="h-5 w-5" />}
                    description={tCoach("kpiCoverageDesc", {
                        covered: totals.users_with_talents,
                        total: totals.people,
                    })}
                />
            </div>

            {/* Clients */}
            <div className="space-y-6">
                <h3 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">
                    {tCoach("clientsHeading")}
                </h3>

                {!hasAnyClients ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-12 sm:p-16 text-center">
                        <Building className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <h4 className="text-lg font-semibold text-slate-700">{tCoach("emptyTitle")}</h4>
                        <p className="mt-2 text-sm text-slate-500">{tCoach("emptyDesc")}</p>
                        <Link
                            href="/dashboard/onboarding"
                            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-sm"
                        >
                            {tCoach("emptyCta")}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {clients.map((client) => (
                            <ClientCard
                                key={client.id}
                                client={client}
                                membersLabel={tCoach("membersLabel")}
                                teamsLabel={tCoach("teamsLabel")}
                                coverageLabel={tCoach("coverageLabel")}
                                openLabel={tCoach("openClient")}
                                onOpen={() => openClient(client.id)}
                            />
                        ))}
                        {individual_clients > 0 && (
                            <Link
                                href="/dashboard/organizations"
                                className="group bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col"
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                                        <UserRound className="h-6 w-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-slate-900 group-hover:text-primary transition-colors">
                                            {tCoach("individualClients")}
                                        </h4>
                                        <p className="text-xs text-slate-500 font-medium">
                                            {tCoach("individualClientsDesc", {
                                                covered: individual_clients_with_talents,
                                                count: individual_clients,
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-auto flex items-center justify-between">
                                    <span className="text-3xl font-bold text-slate-900">{individual_clients}</span>
                                    <span className="text-xs font-semibold text-primary flex items-center gap-1">
                                        {tCoach("goToList")}
                                        <ChevronRight className="h-3 w-3" />
                                    </span>
                                </div>
                            </Link>
                        )}
                    </div>
                )}
            </div>

            {/* Q&A Copilot */}
            <div className="bg-blue-50/50 rounded-3xl border border-blue-100/50 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm ring-1 ring-blue-100 shrink-0">
                    <Sparkles className="h-6 w-6" />
                </div>
                <div className="flex-1">
                    <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                        Q&amp;A Copilot
                    </span>
                    <h4 className="text-xl font-bold text-slate-900 font-heading tracking-tight">
                        {t("askAboutTeam")}
                    </h4>
                    <p className="mt-1 text-slate-600">{t("aiCopilotHint")}</p>
                </div>
                <Link
                    href="/dashboard/qa"
                    className="flex items-center gap-2 text-sm font-bold text-slate-900 hover:gap-3 transition-all shrink-0"
                >
                    {t("openQA")}
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </div>
        </div>
    );
}

function ClientCard({
    client,
    membersLabel,
    teamsLabel,
    coverageLabel,
    openLabel,
    onOpen,
}: {
    client: CoachClientOverview;
    membersLabel: string;
    teamsLabel: string;
    coverageLabel: string;
    openLabel: string;
    onOpen: () => void;
}) {
    const coverage = client.members > 0
        ? Math.round((client.users_with_talents / client.members) * 100)
        : 0;

    return (
        <button
            type="button"
            onClick={onOpen}
            className="group text-left bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
            <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 bg-blue-50 text-primary rounded-2xl flex items-center justify-center shrink-0">
                    <Building className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 group-hover:text-primary transition-colors truncate">
                        {client.name}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                        {client.members} {membersLabel} · {client.teams} {teamsLabel}
                    </p>
                </div>
            </div>

            <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-500">{coverageLabel}</span>
                    <span className="font-bold text-slate-700">{coverage}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${coverage}%` }}
                    />
                </div>
            </div>

            <span className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                {openLabel}
                <ChevronRight className="h-3 w-3" />
            </span>
        </button>
    );
}
