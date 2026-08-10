"use client";

import { useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type BillingInterval, type BillingPlanPrice, type BillingStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Feature bullets are ours; amounts always come from the provider. */
const PLAN_COPY: Record<"pro" | "studio", { name: string; tagline: string; features: string[] }> = {
    pro: {
        name: "Pro",
        tagline: "Dla coacha pracującego z klientami indywidualnymi i firmami",
        features: [
            "Nielimitowane organizacje klienckie",
            "Nielimitowani klienci indywidualni",
            "Q&A Copilot i porównania 1:1",
            "Wizytówka z własnym adresem",
        ],
    },
    studio: {
        name: "Studio",
        tagline: "Dla zespołu coachów i większych wdrożeń",
        features: [
            "Wszystko z planu Pro",
            "Wielu coachów w jednym workspace",
            "Priorytetowe wsparcie",
        ],
    },
};

function formatAmount(price: BillingPlanPrice): string {
    return new Intl.NumberFormat("pl-PL", {
        style: "currency",
        currency: price.currency,
        maximumFractionDigits: price.amount_minor % 100 === 0 ? 0 : 2,
    }).format(price.amount_minor / 100);
}

interface PlanPickerProps {
    status: BillingStatus;
    onError: (message: string) => void;
}

export function PlanPicker({ status, onError }: PlanPickerProps) {
    const [interval, setInterval] = useState<BillingInterval>("monthly");
    const [pending, setPending] = useState<string | null>(null);

    const byPlan = useMemo(() => {
        const map = new Map<string, BillingPlanPrice>();
        status.plans.filter((p) => p.interval === interval).forEach((p) => map.set(p.plan, p));
        return map;
    }, [status.plans, interval]);

    const hasYearly = status.plans.some((p) => p.interval === "yearly");

    const startCheckout = async (plan: "pro" | "studio") => {
        setPending(plan);
        try {
            const { url } = await api.billing.checkout(plan, interval);
            window.location.assign(url);
        } catch {
            onError("Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę.");
            setPending(null);
        }
    };

    if (status.plans.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Żaden plan nie jest obecnie skonfigurowany do sprzedaży.
            </p>
        );
    }

    return (
        <div className="space-y-5">
            {hasYearly && (
                <div className="flex w-fit rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                    {(["monthly", "yearly"] as BillingInterval[]).map((value) => (
                        <button
                            key={value}
                            onClick={() => setInterval(value)}
                            aria-pressed={interval === value}
                            className={cn(
                                "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                                interval === value
                                    ? "bg-white text-indigo-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            {value === "monthly" ? "Miesięcznie" : "Rocznie"}
                        </button>
                    ))}
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
                {(["pro", "studio"] as const).map((plan) => {
                    const price = byPlan.get(plan);
                    if (!price) return null;
                    const copy = PLAN_COPY[plan];
                    const isCurrent = status.plan === plan && status.subscription_status === "active";

                    return (
                        <div
                            key={plan}
                            className={cn(
                                "flex flex-col rounded-2xl border p-5",
                                isCurrent ? "border-blue-300 bg-blue-50/40" : "border-slate-200 bg-white"
                            )}
                        >
                            <div className="flex items-baseline justify-between gap-2">
                                <h3 className="text-lg font-semibold text-slate-900">{copy.name}</h3>
                                {isCurrent && (
                                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                        Twój plan
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{copy.tagline}</p>

                            <p className="mt-4">
                                <span className="text-2xl font-semibold text-slate-900">{formatAmount(price)}</span>
                                <span className="text-sm text-muted-foreground">
                                    {interval === "monthly" ? " / mies." : " / rok"}
                                </span>
                            </p>

                            <ul className="mt-4 space-y-1.5">
                                {copy.features.map((feature) => (
                                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <Button
                                variant={plan === "pro" ? "hero" : "outline"}
                                className="mt-5 w-full"
                                disabled={isCurrent || pending !== null}
                                onClick={() => startCheckout(plan)}
                            >
                                {pending === plan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isCurrent ? "Aktywny" : `Wybierz ${copy.name}`}
                            </Button>
                        </div>
                    );
                })}
            </div>

            {status.trial_days_left > 0 && (
                <p className="text-xs text-muted-foreground">
                    Masz jeszcze {status.trial_days_left} dni okresu testowego — po dodaniu karty nie pobierzemy nic aż
                    do jego końca.
                </p>
            )}
        </div>
    );
}
