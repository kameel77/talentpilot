"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getLocaleFromCookie } from "@/lib/locale";
import { api, User, CompareResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
    ArrowRightLeft,
    Users,
    Zap,
    Lightbulb,
    Loader2,
    ChevronDown,
    Star,
    Sparkles,
    Shield,
    Heart,
    Target,
} from "lucide-react";

function getInitials(name: string): string {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function SynergyGauge({ score, highLabel, mediumLabel, lowLabel }: { score: number; highLabel: string; mediumLabel: string; lowLabel: string }) {
    const t = useTranslations('compare');
    const circumference = 2 * Math.PI * 54;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 70 ? "text-emerald-500" : score >= 40 ? "text-amber-500" : "text-rose-500";
    const bgRing = score >= 70 ? "stroke-emerald-100" : score >= 40 ? "stroke-amber-100" : "stroke-rose-100";
    const label = score >= 70 ? highLabel : score >= 40 ? mediumLabel : lowLabel;

    return (
        <div className="flex flex-col items-center">
            <div className="relative w-36 h-36">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" className={bgRing} strokeWidth="8" />
                    <circle
                        cx="60" cy="60" r="54" fill="none"
                        className={color}
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{ transition: "stroke-dashoffset 1.5s ease-in-out" }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={cn("text-3xl font-black", color)}>{score}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('points')}</span>
                </div>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-600">{label}</p>
        </div>
    );
}

function UserSelector({
    users,
    selectedId,
    onChange,
    label,
    excludeId,
    placeholderText,
    noUsersText,
}: {
    users: User[];
    selectedId: number | null;
    onChange: (id: number) => void;
    label: string;
    excludeId: number | null;
    placeholderText: string;
    noUsersText: string;
}) {
    const [open, setOpen] = useState(false);
    const filtered = users.filter(u => u.id !== excludeId);
    const selected = users.find(u => u.id === selectedId);

    return (
        <div className="relative w-full">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{label}</label>
            <button
                onClick={() => setOpen(!open)}
                className={cn(
                    "w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                    open ? "border-primary bg-blue-50/50" : "border-slate-200 bg-white hover:border-slate-300",
                )}
            >
                {selected ? (
                    <>
                        <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                            {getInitials(selected.full_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900 truncate">{selected.full_name}</p>
                            <p className="text-xs text-slate-400">{selected.email}</p>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center gap-3 text-slate-400">
                        <Users className="h-5 w-5" />
                        <span className="font-medium">{placeholderText}</span>
                    </div>
                )}
                <ChevronDown className={cn("h-4 w-4 text-slate-400 shrink-0 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                <div className="absolute z-30 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl max-h-64 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <p className="p-4 text-sm text-slate-400">{noUsersText}</p>
                    ) : (
                        filtered.map(user => (
                            <button
                                key={user.id}
                                onClick={() => { onChange(user.id); setOpen(false); }}
                                className={cn(
                                    "w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl",
                                    selectedId === user.id && "bg-blue-50",
                                )}
                            >
                                <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                    {getInitials(user.full_name)}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm text-slate-900 truncate">{user.full_name}</p>
                                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default function ComparePage() {
    const t = useTranslations('compare');

    const DOMAIN_META: Record<string, { label: string; color: string; bg: string; icon: typeof Target }> = {
        executing: { label: t('domainExecuting'), color: "text-domain-executing", bg: "bg-domain-executing", icon: Target },
        influencing: { label: t('domainInfluencing'), color: "text-domain-influencing", bg: "bg-domain-influencing", icon: Zap },
        relationship_building: { label: t('domainRelationship'), color: "text-domain-relationship", bg: "bg-domain-relationship", icon: Heart },
        strategic_thinking: { label: t('domainStrategic'), color: "text-domain-strategic", bg: "bg-domain-strategic", icon: Lightbulb },
    };

    const [users, setUsers] = useState<User[]>([]);
    const [userAId, setUserAId] = useState<number | null>(null);
    const [userBId, setUserBId] = useState<number | null>(null);
    const [result, setResult] = useState<CompareResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [usersLoading, setUsersLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadUsers = async () => {
            try {
                const data = await api.users.list();
                setUsers(data);
            } catch {
                setError(t('loadError'));
            } finally {
                setUsersLoading(false);
            }
        };
        loadUsers();
    }, []);

    useEffect(() => {
        if (!userAId || !userBId) {
            setResult(null);
            return;
        }
        const compare = async () => {
            setLoading(true);
            setError("");
            try {
                const data = await api.compare.users(userAId, userBId, getLocaleFromCookie());
                setResult(data);
            } catch (err: unknown) {
                const axiosErr = err as { response?: { data?: { detail?: string } } };
                setError(axiosErr?.response?.data?.detail || t('compareError'));
                setResult(null);
            } finally {
                setLoading(false);
            }
        };
        compare();
    }, [userAId, userBId]);

    const swap = () => {
        setUserAId(userBId);
        setUserBId(userAId);
    };

    if (usersLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-slate-500">{t('loadingUsers')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">{t('title')}</h1>
                <p className="mt-1 text-slate-500 font-medium">
                    {t('subtitle')}
                </p>
            </div>

            {/* User Selectors */}
            <div className="bg-white rounded-3xl border border-slate-200/60 p-6 sm:p-8 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
                    <UserSelector
                        users={users}
                        selectedId={userAId}
                        onChange={setUserAId}
                        label={t('selectUserA')}
                        excludeId={userBId}
                        placeholderText={t('selectPerson')}
                        noUsersText={t('noUsersAvailable')}
                    />

                    <button
                        onClick={swap}
                        disabled={!userAId || !userBId}
                        className="self-center p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={t('swap')}
                    >
                        <ArrowRightLeft className="h-5 w-5 text-slate-500" />
                    </button>

                    <UserSelector
                        users={users}
                        selectedId={userBId}
                        onChange={setUserBId}
                        label={t('selectUserB')}
                        excludeId={userAId}
                        placeholderText={t('selectPerson')}
                        noUsersText={t('noUsersAvailable')}
                    />
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-700">
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm font-medium text-slate-500">{t('analyzing')}</p>
                    </div>
                </div>
            )}

            {/* Results */}
            {result && !loading && (
                <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                    {/* Synergy Score & Domain Balance */}
                    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
                        {/* Synergy Score */}
                        <div className="bg-white rounded-3xl border border-slate-200/60 p-8 shadow-sm flex flex-col items-center justify-center">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">{t('synergyScore')}</h3>
                            <SynergyGauge score={result.synergy_score} highLabel={t('highSynergy')} mediumLabel={t('mediumSynergy')} lowLabel={t('lowSynergy')} />
                        </div>

                        {/* Domain Balance */}
                        <div className="bg-white rounded-3xl border border-slate-200/60 p-6 sm:p-8 shadow-sm">
                            <h3 className="text-lg font-bold font-heading text-slate-900 mb-6">{t('domainBalance')}</h3>
                            <div className="space-y-5">
                                {result.domain_balance.map(db => {
                                    const meta = DOMAIN_META[db.domain] || { label: db.domain_label, color: "text-slate-600", bg: "bg-slate-400", icon: Star };
                                    const max = Math.max(db.count_a, db.count_b, 1);
                                    return (
                                        <div key={db.domain} className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <meta.icon className={cn("h-4 w-4", meta.color)} />
                                                    <span className="font-bold text-slate-700">{meta.label}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs font-semibold">
                                                    <span className="text-indigo-600">{db.count_a}</span>
                                                    <span className="text-slate-300">vs</span>
                                                    <span className="text-emerald-600">{db.count_b}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-1.5 h-3">
                                                <div
                                                    className="bg-indigo-500 rounded-full transition-all duration-700"
                                                    style={{ width: `${(db.count_a / max) * 100}%`, minWidth: db.count_a > 0 ? 12 : 0 }}
                                                />
                                                <div
                                                    className="bg-emerald-500 rounded-full transition-all duration-700"
                                                    style={{ width: `${(db.count_b / max) * 100}%`, minWidth: db.count_b > 0 ? 12 : 0 }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-6 flex items-center gap-6 text-xs font-semibold text-slate-400">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-indigo-500" />
                                    {result.user_a.full_name}
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                                    {result.user_b.full_name}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Shared Talents (Bridges) */}
                    <div className="bg-white rounded-3xl border border-slate-200/60 p-6 sm:p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                                <Sparkles className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold font-heading text-slate-900">{t('sharedTalents')}</h3>
                                <p className="text-xs text-slate-400">{t('sharedTalentsDesc')}</p>
                            </div>
                        </div>

                        {result.shared_talents.length === 0 ? (
                            <p className="text-sm text-slate-400 py-4">
                                {t('noSharedTalents')}
                            </p>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {result.shared_talents.map(talent => {
                                    const meta = DOMAIN_META[talent.domain];
                                    return (
                                        <div
                                            key={talent.code}
                                            className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/50"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", meta?.bg + "/20")}>
                                                    <Star className={cn("h-4 w-4", meta?.color)} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900">{talent.name}</p>
                                                    <p className="text-[11px] text-slate-400">{meta?.label}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs">
                                                <span className="font-bold text-indigo-600">#{talent.rank_a}</span>
                                                <span className="text-slate-300">•</span>
                                                <span className="font-bold text-emerald-600">#{talent.rank_b}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Unique Talents */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Unique A */}
                        <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="h-8 w-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                                    {getInitials(result.user_a.full_name)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-sm">{result.user_a.full_name}</h3>
                                    <p className="text-[11px] text-slate-400">{t('uniqueStrengths')}</p>
                                </div>
                            </div>
                            {result.unique_a.length === 0 ? (
                                <p className="text-sm text-slate-400">{t('noUniqueTalents')}</p>
                            ) : (
                                <div className="space-y-2">
                                    {result.unique_a.map(t => {
                                        const meta = DOMAIN_META[t.domain];
                                        return (
                                            <div key={t.code} className="flex items-center gap-3 py-2">
                                                <span
                                                    className={cn("h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white", meta?.bg)}
                                                >
                                                    {t.rank}
                                                </span>
                                                <span className="text-sm font-medium text-slate-700">{t.name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Unique B */}
                        <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm">
                                    {getInitials(result.user_b.full_name)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-sm">{result.user_b.full_name}</h3>
                                    <p className="text-[11px] text-slate-400">{t('uniqueStrengths')}</p>
                                </div>
                            </div>
                            {result.unique_b.length === 0 ? (
                                <p className="text-sm text-slate-400">{t('noUniqueTalents')}</p>
                            ) : (
                                <div className="space-y-2">
                                    {result.unique_b.map(t => {
                                        const meta = DOMAIN_META[t.domain];
                                        return (
                                            <div key={t.code} className="flex items-center gap-3 py-2">
                                                <span
                                                    className={cn("h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white", meta?.bg)}
                                                >
                                                    {t.rank}
                                                </span>
                                                <span className="text-sm font-medium text-slate-700">{t.name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Collaboration Tips */}
                    {result.collaboration_tips.length > 0 && (
                        <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 rounded-3xl border border-blue-100/50 p-6 sm:p-8 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="h-10 w-10 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                                    <Shield className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold font-heading text-slate-900">{t('collaborationTips')}</h3>
                                    <p className="text-xs text-slate-400">{t('collaborationTipsDesc')}</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {result.collaboration_tips.map((tip, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-3 p-4 bg-white/70 rounded-2xl border border-white"
                                    >
                                        <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                                        <p className="text-sm text-slate-700 leading-relaxed">{tip}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Empty state */}
            {!result && !loading && !error && (
                <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 sm:p-16 text-center shadow-sm">
                    <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center">
                        <ArrowRightLeft className="h-8 w-8 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">{t('noResult')}</h3>
                    <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
                        {t('noResultDesc')}
                    </p>
                </div>
            )}
        </div>
    );
}
