"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { KPICard } from "@/components/ui/KPICard";
import { Users, UserPlus, Shield, UserCheck } from "lucide-react";

interface UserSummary {
    id: number;
    full_name: string;
    email: string;
    role: string;
    is_active?: boolean;
}

export default function UsersPage() {
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const data = await api.users.list();
            setUsers(data);
        } catch (_err) {
            setError("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm font-medium text-slate-500">Loading your team...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">Users</h1>
                    <p className="mt-2 text-slate-500 max-w-2xl">
                        Manage your organization&apos;s members, assign roles, and track talent development progress across teams.
                    </p>
                </div>
                <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-sm hover:shadow-md active:scale-95">
                    <UserPlus className="h-4 w-4" />
                    Invite User
                </button>
            </div>

            {/* Metrics Overview */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard
                    title="Total Users"
                    value={users.length}
                    icon={<Users className="h-5 w-5" />}
                />
                <KPICard
                    title="Active Now"
                    value={users.filter(u => u.is_active !== false).length}
                    icon={<UserCheck className="h-5 w-5" />}
                    trend={{ value: 12, isPositive: true }}
                />
                <KPICard
                    title="Admins"
                    value={users.filter(u => u.role.toLowerCase() === 'admin').length}
                    icon={<Shield className="h-5 w-5" />}
                />
                <KPICard
                    title="Avg Talents/User"
                    value="5.2"
                    description="CliftonStrengths Top 5"
                />
            </div>

            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-700 animate-fade-up">
                    {error}
                </div>
            )}

            {users.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-16 text-center animate-fade-up">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <Users className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">No users found</h3>
                    <p className="mt-2 text-slate-500 max-w-xs mx-auto">
                        Your organization is empty. Start by inviting your first team member.
                    </p>
                    <button className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-sm hover:shadow-md">
                        <UserPlus className="h-4 w-4" />
                        Invite First User
                    </button>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 animate-fade-up">
                    {users.map((user) => (
                        <Link
                            key={user.id}
                            href={`/dashboard/users/${user.id}`}
                            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-primary transition-colors">
                                        <span className="text-lg font-bold font-heading">
                                            {user.full_name.charAt(0)}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors">
                                            {user.full_name}
                                        </h3>
                                        <p className="text-xs text-slate-400 font-medium">{user.email}</p>
                                    </div>
                                </div>
                                <span className={cn(
                                    "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                    user.role.toLowerCase() === 'admin'
                                        ? "bg-amber-50 text-amber-600 border border-amber-100"
                                        : "bg-blue-50 text-blue-600 border border-blue-100"
                                )}>
                                    {user.role}
                                </span>
                            </div>

                            <div className="mt-8 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <div className={cn(
                                        "h-2 w-2 rounded-full",
                                        user.is_active !== false ? "bg-emerald-500" : "bg-slate-300"
                                    )} />
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                                        {user.is_active !== false ? "Active" : "Inactive"}
                                    </span>
                                </div>
                                <span className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                    View profile
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
