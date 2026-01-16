"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { KPICard } from "@/components/ui/KPICard";
import { Users, Plus } from "lucide-react";

interface Team {
    id: number;
    name: string;
    description?: string;
    manager_id?: number;
}

export default function TeamsPage() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        loadTeams();
    }, []);

    const loadTeams = async () => {
        try {
            const data = await api.teams.list();
            setTeams(data);
        } catch (_err) {
            setError("Failed to load teams");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm font-medium text-slate-500">Loading your teams...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">Teams</h1>
                    <p className="mt-2 text-slate-500 max-w-2xl">
                        Organize your workforce into high-performing units based on their unique talent combinations.
                    </p>
                </div>
                <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-sm hover:shadow-md active:scale-95">
                    <Plus className="h-4 w-4" />
                    Add Team
                </button>
            </div>

            {/* Metrics Overview */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <KPICard
                    title="Active Teams"
                    value={teams.length}
                    icon={<Users className="h-5 w-5" />}
                />
                <KPICard
                    title="Avg Team Size"
                    value="4.5"
                    description="People per team"
                />
                <KPICard
                    title="Top Domain"
                    value="Strategic"
                    description="Most frequent in org"
                />
            </div>

            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-700">
                    {error}
                </div>
            )}

            {teams.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-16 text-center animate-fade-up">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <Users className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">No teams found</h3>
                    <p className="mt-2 text-slate-500 max-w-xs mx-auto">
                        Your organization has no teams yet. Start by defining your first collaborative unit.
                    </p>
                    <button className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-sm hover:shadow-md">
                        <Plus className="h-4 w-4" />
                        Create Your First Team
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-up">
                    {teams.map((team) => (
                        <Link
                            key={team.id}
                            href={`/dashboard/teams/${team.id}`}
                            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5"
                        >
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors mb-2">
                                    {team.name}
                                </h3>
                                {team.description && (
                                    <p className="text-sm text-slate-500 line-clamp-2">{team.description}</p>
                                )}
                            </div>
                            <div className="mt-8 flex items-center justify-between">
                                <span className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                    Manage team
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
