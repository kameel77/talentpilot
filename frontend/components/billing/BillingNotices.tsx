"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Check, Clock, X } from "lucide-react";
import { api, tokenManager, PLAN_LIMIT_EVENT, type BillingStatus, type PlanLimitExceeded } from "@/lib/api";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BILLING_HREF = "/dashboard/settings/billing";

/** Show the countdown only once it is worth acting on. */
const TRIAL_WARNING_DAYS = 7;

const LIMIT_COPY: Record<PlanLimitExceeded["resource"], { title: string; body: string }> = {
    client_orgs: {
        title: "Organizacje klienckie wymagają płatnego planu",
        body: "Na planie Free możesz pracować z klientami indywidualnymi. Dodawanie organizacji klienckich odblokujesz w planie Pro.",
    },
    profiles: {
        title: "Osiągnąłeś limit klientów w planie Free",
        body: "Plan Free obejmuje 3 klientów indywidualnych. Wybierz plan Pro, aby dodawać ich bez ograniczeń.",
    },
};

/**
 * One place for every billing-driven interruption: the trial countdown,
 * the result of a returning Stripe Checkout, and the plan-limit dialog
 * raised by the 402 interceptor in lib/api.ts.
 */
export function BillingNotices() {
    const [status, setStatus] = useState<BillingStatus | null>(null);
    const [dismissed, setDismissed] = useState(false);
    const [checkoutResult, setCheckoutResult] = useState<"success" | "cancelled" | null>(null);
    const [limit, setLimit] = useState<PlanLimitExceeded | null>(null);

    const load = useCallback(() => {
        if (!tokenManager.getUser()) return;
        api.billing.status().then(setStatus).catch(() => setStatus(null));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // Stripe sends the customer back to /dashboard?checkout=... — read it
    // from the URL directly (rather than useSearchParams) so this component
    // needs no Suspense boundary, then clean the query string.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const result = params.get("checkout");
        if (result !== "success" && result !== "cancelled") return;

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCheckoutResult(result);
        params.delete("checkout");
        const query = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
        if (result === "success") {
            // The subscription lands via webhook, which may arrive a moment
            // after the browser does — re-read shortly after.
            setTimeout(load, 2500);
        }
    }, [load]);

    useEffect(() => {
        const handler = (event: Event) => setLimit((event as CustomEvent<PlanLimitExceeded>).detail);
        window.addEventListener(PLAN_LIMIT_EVENT, handler);
        return () => window.removeEventListener(PLAN_LIMIT_EVENT, handler);
    }, []);

    const showTrial =
        !dismissed &&
        status?.subscription_status === "trialing" &&
        status.trial_days_left > 0 &&
        status.trial_days_left <= TRIAL_WARNING_DAYS;
    const showExpired = !dismissed && status?.subscription_status === "free";
    const showPastDue = status?.subscription_status === "past_due";

    return (
        <>
            {checkoutResult && (
                <Banner
                    tone={checkoutResult === "success" ? "success" : "neutral"}
                    icon={checkoutResult === "success" ? Check : X}
                    onClose={() => setCheckoutResult(null)}
                >
                    {checkoutResult === "success"
                        ? "Dziękujemy — subskrypcja jest aktywna. Szczegóły znajdziesz w Rozliczeniach."
                        : "Płatność została przerwana. Nic nie zostało pobrane."}
                </Banner>
            )}

            {showPastDue && (
                <Banner tone="danger" icon={AlertTriangle} href={BILLING_HREF} cta="Napraw płatność">
                    Ostatnia płatność się nie powiodła. Bez aktualizacji karty plan zostanie obniżony do Free.
                </Banner>
            )}

            {showTrial && (
                <Banner
                    tone="warning"
                    icon={Clock}
                    href={BILLING_HREF}
                    cta="Wybierz plan"
                    onClose={() => setDismissed(true)}
                >
                    Okres testowy kończy się za {status?.trial_days_left ?? 0}{" "}
                    {(status?.trial_days_left ?? 0) === 1 ? "dzień" : "dni"}.
                </Banner>
            )}

            {showExpired && (
                <Banner
                    tone="warning"
                    icon={AlertTriangle}
                    href={BILLING_HREF}
                    cta="Zobacz plany"
                    onClose={() => setDismissed(true)}
                >
                    Jesteś na planie Free — bez organizacji klienckich i z limitem 3 klientów indywidualnych.
                </Banner>
            )}

            <Dialog open={limit !== null} onOpenChange={(open) => !open && setLimit(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <DialogTitle className="text-left text-lg font-semibold text-slate-900">
                                {limit && limit.resource && LIMIT_COPY[limit.resource]
                                    ? LIMIT_COPY[limit.resource].title
                                    : "Osiągnięto limit planu"}
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-left text-slate-600 pt-2">
                            {limit && limit.resource && LIMIT_COPY[limit.resource]
                                ? LIMIT_COPY[limit.resource].body
                                : "Ta operacja nie może być zrealizowana ze względu na ograniczenia Twojego obecnego planu."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm text-slate-700 mt-2">
                        <p className="font-semibold text-slate-900">Co możesz teraz zrobić?</p>
                        <ul className="list-disc pl-4 space-y-1 text-slate-600 text-xs sm:text-sm">
                            {status?.enabled ? (
                                <>
                                    <li><strong>Wybierz wyższy plan</strong> (np. Pro lub Studio) w zakładce Rozliczenia, aby zdjąć ograniczenia.</li>
                                    <li><strong>Zwolnij miejsce</strong>, usuwając niepotrzebne profile osób lub organizacje.</li>
                                </>
                            ) : (
                                <>
                                    <li><strong>Zwolnij miejsce</strong> w obecnym planie, usuwając niepotrzebne osoby lub zespoły.</li>
                                    <li><strong>Skontaktuj się z administratorem</strong>, jeśli potrzebujesz zwiększenia limitów lub przedłużenia okresu próbnego.</li>
                                </>
                            )}
                        </ul>
                        {!status?.enabled && (
                            <p className="text-xs text-amber-700 pt-1">
                                ℹ️ Zakup planu online jest obecnie konfigurowany w tym środowisku.
                            </p>
                        )}
                    </div>

                    <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                        <Button variant="outline" onClick={() => setLimit(null)} className="w-full sm:w-auto">
                            Zamknij
                        </Button>
                        <Button variant="outline" asChild className="w-full sm:w-auto">
                            <Link href="/dashboard" onClick={() => setLimit(null)}>
                                Wróć do Dashboardu
                            </Link>
                        </Button>
                        {status?.enabled ? (
                            <Button variant="hero" asChild className="w-full sm:w-auto">
                                <Link href={BILLING_HREF} onClick={() => setLimit(null)}>
                                    Zobacz plany
                                </Link>
                            </Button>
                        ) : null}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

interface BannerProps {
    tone: "success" | "warning" | "danger" | "neutral";
    icon: React.ElementType;
    children: React.ReactNode;
    href?: string;
    cta?: string;
    onClose?: () => void;
}

const TONE_STYLES: Record<BannerProps["tone"], string> = {
    success: "border-green-200 bg-green-50 text-green-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
};

function Banner({ tone, icon: Icon, children, href, cta, onClose }: BannerProps) {
    return (
        <div className={cn("mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm", TONE_STYLES[tone])}>
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{children}</span>
            {href && cta && (
                <Link href={href} className="inline-flex shrink-0 items-center gap-1 font-semibold hover:underline">
                    {cta}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
            )}
            {onClose && (
                <button onClick={onClose} aria-label="Zamknij" className="shrink-0 opacity-60 hover:opacity-100">
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}
