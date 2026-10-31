"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Link2, MonitorPlay, UserPlus, X } from "lucide-react";
import { CoachDashboardOverview, tokenManager } from "@/lib/api";
import { setFirstStepFlag, useFirstStepFlag } from "@/lib/firstSteps";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FirstStepsChecklistProps {
    data: CoachDashboardOverview;
    onAddClient: () => void;
}

interface StepItem {
    key: string;
    icon: React.ReactNode;
    done: boolean;
    title: string;
    description: string;
    cta?: { label: string; onClick: () => void };
    hint?: string;
}

/**
 * The AI assistant is intentionally not a step until it has been refined
 * (decision 2026-10-31); `first_steps.qa_queries` stays available for later.
 *
 * Coach "First steps": the value moments after signup, ticked off
 * automatically from data (backend facts + browser-side signals).
 * Hidden once complete or dismissed.
 */
export function FirstStepsChecklist({ data, onAddClient }: FirstStepsChecklistProps) {
    const t = useTranslations("dashboard.coach.firstSteps");
    const router = useRouter();
    const linkCopied = useFirstStepFlag("link_copied");
    const dismissed = useFirstStepFlag("dismissed");

    const steps = data.first_steps;
    const suggestedTeam = steps?.suggested_team ?? null;
    const hasClients = data.clients.length > 0 || data.individual_clients > 0;

    const openTeam = (query = "") => {
        if (!suggestedTeam) return;
        // Team pages read the active org from storage — same mechanism as the client cards.
        tokenManager.setActiveOrgId(suggestedTeam.organization_id);
        window.location.assign(`/dashboard/teams/${suggestedTeam.id}${query}`);
    };

    const items: StepItem[] = [
        {
            key: "client",
            icon: <UserPlus className="h-4 w-4" />,
            done: hasClients,
            title: t("addClientTitle"),
            description: t("addClientDesc"),
            cta: { label: t("addClientCta"), onClick: onAddClient },
        },
        {
            key: "link",
            icon: <Link2 className="h-4 w-4" />,
            done: linkCopied,
            title: t("shareLinkTitle"),
            description: t("shareLinkDesc"),
            ...(data.individual_clients > 0
                ? { cta: { label: t("shareLinkCta"), onClick: () => router.push("/dashboard/organizations?tab=individuals") } }
                : suggestedTeam && suggestedTeam.members > 0
                  ? { cta: { label: t("shareLinkTeamCta"), onClick: () => openTeam() } }
                  : { hint: t("needClientHint") }),
        },
        {
            key: "presentation",
            icon: <MonitorPlay className="h-4 w-4" />,
            done: (steps?.presentation_links ?? 0) > 0,
            title: t("presentationTitle"),
            description: t("presentationDesc"),
            ...(suggestedTeam && suggestedTeam.members > 0
                ? { cta: { label: t("presentationCta", { team: suggestedTeam.name }), onClick: () => openTeam("?presentation=1") } }
                : { hint: t("needTeamHint") }),
        },
    ];

    const doneCount = items.filter((i) => i.done).length;
    if (dismissed || doneCount === items.length) return null;

    // The first unfinished step is the one we push; the rest stay quiet.
    const nextKey = items.find((i) => !i.done)?.key;

    return (
        <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-white p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                    <h3 className="text-xl font-bold font-heading text-slate-900 tracking-tight">{t("title")}</h3>
                    <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
                </div>
                <button
                    type="button"
                    onClick={() => setFirstStepFlag("dismissed")}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 shrink-0"
                    aria-label={t("dismiss")}
                >
                    <X className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("dismiss")}</span>
                </button>
            </div>

            <div className="mb-5 space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                    <span className="text-primary">{t("progress", { done: doneCount, total: items.length })}</span>
                </div>
                <div className="h-1.5 w-full bg-blue-100 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${(doneCount / items.length) * 100}%` }}
                    />
                </div>
            </div>

            <ol className="space-y-2">
                {items.map((item) => {
                    const isNext = item.key === nextKey;
                    return (
                        <li
                            key={item.key}
                            className={cn(
                                "flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border p-4 transition-colors",
                                item.done
                                    ? "border-transparent bg-white/50"
                                    : isNext
                                      ? "border-primary/30 bg-white shadow-sm"
                                      : "border-slate-200 bg-white"
                            )}
                        >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                {item.done ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                                ) : (
                                    <Circle className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
                                )}
                                <div className="min-w-0">
                                    <p
                                        className={cn(
                                            "font-semibold text-sm flex items-center gap-1.5",
                                            item.done ? "text-slate-400 line-through" : "text-slate-900"
                                        )}
                                    >
                                        <span className="text-slate-400">{item.icon}</span>
                                        {item.title}
                                    </p>
                                    {!item.done && <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>}
                                    {!item.done && item.hint && (
                                        <p className="text-xs text-slate-400 mt-1 italic">{item.hint}</p>
                                    )}
                                </div>
                            </div>
                            {!item.done && item.cta && (
                                <Button
                                    size="sm"
                                    variant={isNext ? "default" : "outline"}
                                    onClick={item.cta.onClick}
                                    className="shrink-0 sm:ml-auto"
                                >
                                    {item.cta.label}
                                </Button>
                            )}
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
