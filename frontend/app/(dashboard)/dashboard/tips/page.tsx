"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, tokenManager, User, DailyTipResponse, SynergyTipResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
    Zap,
    Lightbulb,
    Loader2,
    RefreshCw,
    ThumbsUp,
    ThumbsDown,
    ChevronDown,
    Users,
    Heart,
    Target,
    Star,
    Sparkles,
    MessageCircle,
    Shield,
    Flame,
    Handshake,
} from "lucide-react";

const CONTEXT_ICONS: Record<string, React.FC<{ className?: string }>> = {
    general: Sparkles,
    feedback: MessageCircle,
    one_on_one: Handshake,
    conflict: Shield,
    motivation: Flame,
};

const DOMAIN_META: Record<string, { label: string; color: string; bg: string }> = {
    executing: { label: "Realizacja", color: "text-domain-executing", bg: "bg-domain-executing" },
    influencing: { label: "Wpływanie", color: "text-domain-influencing", bg: "bg-domain-influencing" },
    relationship_building: { label: "Budowanie relacji", color: "text-domain-relationship", bg: "bg-domain-relationship" },
    strategic_thinking: { label: "Myślenie strategiczne", color: "text-domain-strategic", bg: "bg-domain-strategic" },
};

function getInitials(name: string): string {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function FeedbackButtons({
    tipId,
    onFeedback,
    labelHelpful,
    labelNotHelpful,
    labelQuestion,
    labelThankYes,
    labelThankNo,
}: {
    tipId: number | null;
    onFeedback: (tipId: number, helpful: boolean) => void;
    labelHelpful: string;
    labelNotHelpful: string;
    labelQuestion: string;
    labelThankYes: string;
    labelThankNo: string;
}) {
    const [submitted, setSubmitted] = useState<boolean | null>(null);

    if (!tipId) return null;

    if (submitted !== null) {
        return (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                {submitted ? (
                    <><ThumbsUp className="h-3.5 w-3.5 text-emerald-500" /> {labelThankYes}</>
                ) : (
                    <><ThumbsDown className="h-3.5 w-3.5 text-rose-400" /> {labelThankNo}</>
                )}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 mr-1">{labelQuestion}</span>
            <button
                onClick={() => { onFeedback(tipId, true); setSubmitted(true); }}
                className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                title={labelHelpful}
            >
                <ThumbsUp className="h-4 w-4" />
            </button>
            <button
                onClick={() => { onFeedback(tipId, false); setSubmitted(false); }}
                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                title={labelNotHelpful}
            >
                <ThumbsDown className="h-4 w-4" />
            </button>
        </div>
    );
}

function TipContent({ content }: { content: string }) {
    // Parse the structured response (WSKAZÓWKA / DLACZEGO / DLA LIDERA)
    const sections = content.split(/\n/).filter(Boolean);

    // Try to parse structured format
    const wskazowka = sections.find(s => s.startsWith("WSKAZÓWKA:"))?.replace("WSKAZÓWKA:", "").trim();
    const dlaczego = sections.find(s => s.startsWith("DLACZEGO:"))?.replace("DLACZEGO:", "").trim();
    const dlaLidera = sections.find(s => s.startsWith("DLA LIDERA:"))?.replace("DLA LIDERA:", "").trim();

    if (wskazowka) {
        return (
            <div className="space-y-4">
                <div>
                    <p className="text-slate-800 leading-relaxed font-medium">{wskazowka}</p>
                </div>
                {dlaczego && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/50 border border-blue-100/50">
                        <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-blue-700">{dlaczego}</p>
                    </div>
                )}
                {dlaLidera && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/50 border border-amber-100/50">
                        <MessageCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-700">{dlaLidera}</p>
                    </div>
                )}
            </div>
        );
    }

    // Fallback: render as plain text
    return <p className="text-slate-800 leading-relaxed">{content}</p>;
}

export default function TipsPage() {
    const t = useTranslations("tips");
    const isCoach = tokenManager.getUser()?.role === 'coach';

    const CONTEXTS = [
        { key: "general", label: t("context.general"), icon: CONTEXT_ICONS.general },
        { key: "feedback", label: t("context.feedback"), icon: CONTEXT_ICONS.feedback },
        { key: "one_on_one", label: t("context.one_on_one"), icon: CONTEXT_ICONS.one_on_one },
        { key: "conflict", label: t("context.conflict"), icon: CONTEXT_ICONS.conflict },
        { key: "motivation", label: t("context.motivation"), icon: CONTEXT_ICONS.motivation },
    ];

    // Users
    const [users, setUsers] = useState<User[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);

    // Mój Ruch
    const [context, setContext] = useState("general");
    const [dailyTip, setDailyTip] = useState<DailyTipResponse | null>(null);
    const [dailyLoading, setDailyLoading] = useState(false);
    const [dailyError, setDailyError] = useState("");

    // Mosty
    const [targetUserId, setTargetUserId] = useState<number | null>(null);
    const [synergyTip, setSynergyTip] = useState<SynergyTipResponse | null>(null);
    const [synergyLoading, setSynergyLoading] = useState(false);
    const [synergyError, setSynergyError] = useState("");
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);

    // Load users
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const data = await api.users.list();
                setUsers(data);
            } catch {
                // silently fail
            } finally {
                setUsersLoading(false);
            }
        };
        loadUsers();
    }, []);

    // Generate daily tip
    const generateDailyTip = async (ctx?: string) => {
        const selectedContext = ctx || context;
        setDailyLoading(true);
        setDailyError("");
        try {
            const data = await api.tips.getDaily(selectedContext);
            setDailyTip(data);
        } catch {
            setDailyError(t("noTalents"));
        } finally {
            setDailyLoading(false);
        }
    };

    // Generate synergy tip
    const generateSynergyTip = async (userId: number) => {
        setTargetUserId(userId);
        setUserDropdownOpen(false);
        setSynergyLoading(true);
        setSynergyError("");
        try {
            const data = await api.tips.getSynergy(userId);
            setSynergyTip(data);
        } catch {
            setSynergyError(t("synergyError"));
        } finally {
            setSynergyLoading(false);
        }
    };

    const handleFeedback = async (tipId: number, helpful: boolean) => {
        try {
            await api.tips.submitFeedback(tipId, helpful);
        } catch {
            // silently fail
        }
    };

    const selectedTargetUser = users.find(u => u.id === targetUserId);

    const feedbackProps = {
        onFeedback: handleFeedback,
        labelHelpful: t("helpful"),
        labelNotHelpful: t("notHelpful"),
        labelQuestion: t("feedbackQuestion"),
        labelThankYes: t("feedbackThankYes"),
        labelThankNo: t("feedbackThankNo"),
    };

    return (
        <div className="max-w-5xl mx-auto w-full space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">{t("title")}</h1>
                <p className="mt-1 text-slate-500 font-medium">
                    {t("subtitle")}
                </p>
            </div>

            {/* ─── SECTION 1: DAILY TIP ─── */}
            {!isCoach && (
                <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Zap className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold font-heading text-slate-900">{t("daily")}</h2>
                        <p className="text-xs text-slate-400">{t("dailySubtitle")}</p>
                    </div>
                </div>

                {/* Context Pills */}
                <div className="flex flex-wrap gap-2">
                    {CONTEXTS.map(ctx => (
                        <button
                            key={ctx.key}
                            onClick={() => { setContext(ctx.key); generateDailyTip(ctx.key); }}
                            className={cn(
                                "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
                                context === ctx.key && dailyTip
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                                    : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50",
                            )}
                        >
                            <ctx.icon className="h-4 w-4" />
                            {ctx.label}
                        </button>
                    ))}
                </div>

                {/* Daily Tip Card */}
                {dailyLoading ? (
                    <div className="bg-white rounded-3xl border border-slate-200/60 p-12 shadow-sm flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                        <p className="text-sm font-medium text-slate-400">{t("generating")}</p>
                    </div>
                ) : dailyError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-700">
                        {dailyError}
                    </div>
                ) : dailyTip ? (
                    <div className="bg-white rounded-3xl border border-slate-200/60 p-6 sm:p-8 shadow-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                        <div className="flex items-start justify-between gap-4 mb-5">
                            <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                                    <Star className="h-4 w-4 text-indigo-600" />
                                </div>
                                <span className="text-sm font-bold text-indigo-600">{dailyTip.talent_focus}</span>
                            </div>
                            <button
                                onClick={() => generateDailyTip()}
                                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                title={t("generate")}
                            >
                                <RefreshCw className="h-4 w-4" />
                            </button>
                        </div>

                        <TipContent content={dailyTip.content} />

                        <div className="mt-6 pt-4 border-t border-slate-100">
                            <FeedbackButtons tipId={dailyTip.tip_id} {...feedbackProps} />
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center shadow-sm">
                        <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                            <Zap className="h-7 w-7 text-indigo-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">{t("selectContext")}</h3>
                        <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
                            {t("selectContextHint")}
                        </p>
                    </div>
                )}
                </div>
            )}

            {/* ─── SECTION 2: SYNERGY ─── */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <Heart className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold font-heading text-slate-900">{t("synergy")}</h2>
                        <p className="text-xs text-slate-400">{t("synergySubtitle")}</p>
                    </div>
                </div>

                {/* User Selector */}
                <div className="relative max-w-md">
                    <button
                        onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                        className={cn(
                            "w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                            userDropdownOpen ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 bg-white hover:border-slate-300",
                        )}
                    >
                        {selectedTargetUser ? (
                            <>
                                <div className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                                    {getInitials(selectedTargetUser.full_name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold text-slate-900 truncate">{selectedTargetUser.full_name}</p>
                                    <p className="text-xs text-slate-400">{t("clickToChange")}</p>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-3 text-slate-400">
                                <Users className="h-5 w-5" />
                                <span className="font-medium">{t("selectMember")}</span>
                            </div>
                        )}
                        <ChevronDown className={cn("h-4 w-4 text-slate-400 shrink-0 transition-transform", userDropdownOpen && "rotate-180")} />
                    </button>

                    {userDropdownOpen && (
                        <div className="absolute z-30 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl max-h-64 overflow-y-auto">
                            {usersLoading ? (
                                <p className="p-4 text-sm text-slate-400">{t("loading")}</p>
                            ) : users.length === 0 ? (
                                <p className="p-4 text-sm text-slate-400">{t("noUsers")}</p>
                            ) : (
                                users.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => generateSynergyTip(user.id)}
                                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                                    >
                                        <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
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

                {/* Synergy Tip */}
                {synergyLoading ? (
                    <div className="bg-white rounded-3xl border border-slate-200/60 p-12 shadow-sm flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                        <p className="text-sm font-medium text-slate-400">
                            {t("synergyAnalyzing", { name: selectedTargetUser?.full_name ?? "" })}
                        </p>
                    </div>
                ) : synergyError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-700">
                        {synergyError}
                    </div>
                ) : synergyTip ? (
                    <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                        {/* AI Interaction Guide */}
                        <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/80 rounded-3xl border border-emerald-100/50 p-6 sm:p-8 shadow-sm">
                            <div className="flex items-start justify-between gap-4 mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                        <Lightbulb className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900">{t("synergyGuideTitle")}</h3>
                                        <p className="text-xs text-slate-400">
                                            {t("synergyGuideSubtitle", { name: synergyTip.target_user_name ?? "", score: synergyTip.synergy_score })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <p className="text-slate-700 leading-relaxed">{synergyTip.content}</p>
                            <div className="mt-5 pt-4 border-t border-emerald-100/50">
                                <FeedbackButtons tipId={synergyTip.tip_id} {...feedbackProps} />
                            </div>
                        </div>

                        {/* Shared Talents + Deterministic Tips */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Shared Talents */}
                            <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm">
                                <h4 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-amber-500" />
                                    {t("sharedTalents")}
                                </h4>
                                {synergyTip.shared_talents.length === 0 ? (
                                    <p className="text-sm text-slate-400">
                                        {t("noSharedTalents")}
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {synergyTip.shared_talents.map(talent => {
                                            const meta = DOMAIN_META[talent.domain];
                                            return (
                                                <div key={talent.code} className="flex items-center justify-between py-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn("h-5 w-5 rounded flex items-center justify-center", meta?.bg + "/20")}>
                                                            <Star className={cn("h-3 w-3", meta?.color)} />
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-700">{talent.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="font-bold text-indigo-500">#{talent.rank_a}</span>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="font-bold text-emerald-500">#{talent.rank_b}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Collaboration Tips */}
                            <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm">
                                <h4 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
                                    <Target className="h-4 w-4 text-blue-500" />
                                    {t("collaborationTips")}
                                </h4>
                                {synergyTip.collaboration_tips.length === 0 ? (
                                    <p className="text-sm text-slate-400">{t("noCollaborationTips")}</p>
                                ) : (
                                    <div className="space-y-2.5">
                                        {synergyTip.collaboration_tips.map((tip, i) => (
                                            <div key={i} className="flex items-start gap-2">
                                                <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                                                    <span className="text-[10px] font-bold text-blue-600">{i + 1}</span>
                                                </div>
                                                <p className="text-sm text-slate-600 leading-relaxed">{tip}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Domain Balance Mini */}
                        {synergyTip.domain_balance.length > 0 && (
                            <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm">
                                <h4 className="font-bold text-sm text-slate-900 mb-4">{t("domainBalance")}</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {synergyTip.domain_balance.map(db => {
                                        const meta = DOMAIN_META[db.domain];
                                        return (
                                            <div key={db.domain} className="text-center space-y-1.5">
                                                <p className={cn("text-xs font-bold", meta?.color)}>{meta?.label || db.domain_label}</p>
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="text-lg font-black text-indigo-600">{db.count_a}</span>
                                                    <span className="text-xs text-slate-300">vs</span>
                                                    <span className="text-lg font-black text-emerald-600">{db.count_b}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                ) : !targetUserId ? (
                    <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center shadow-sm">
                        <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                            <Heart className="h-7 w-7 text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">{t("selectMember")}</h3>
                        <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
                            {t("selectMemberHint")}
                        </p>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
