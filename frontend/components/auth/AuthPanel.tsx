"use client";

import { useTranslations } from "next-intl";
import { useAuthPanelRole } from "@/components/auth/AuthPanelContext";

/**
 * Marketing panel shown on the right-hand side of the (auth) shell.
 * Copy reacts to the role selected on the register page (see
 * AuthPanelContext) - every other auth page simply gets the default copy.
 */
export function AuthPanel() {
    const { role } = useAuthPanelRole();
    const t = useTranslations("auth.panel");
    const isCoach = role === "coach";

    return (
        <div className="hidden lg:flex lg:flex-1 bg-gradient-hero relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-domain-strategic/20 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-domain-relationship/20 via-transparent to-transparent" />

            <div className="relative z-10 flex flex-col justify-center p-12 text-white">
                <div className="max-w-lg">
                    <h2 className="text-display mb-6">
                        {isCoach ? t("coachTitleLead") : t("titleLead")}{" "}
                        <span className="text-domain-strategic">
                            {isCoach ? t("coachTitleHighlight") : t("titleHighlight")}
                        </span>
                        {!isCoach && <>{" "}{t("titleTail")}</>}
                    </h2>
                    <p className="text-lg text-white/80 leading-relaxed mb-8">
                        {isCoach ? t("coachBody") : t("body")}
                    </p>

                    <div className="grid grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <p className="text-3xl font-bold font-heading">34</p>
                            <p className="text-sm text-white/60">{t("statTalents")}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-bold font-heading">4</p>
                            <p className="text-sm text-white/60">{t("statDomains")}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-bold font-heading">INF</p>
                            <p className="text-sm text-white/60">{t("statOpportunities")}</p>
                        </div>
                    </div>
                </div>

                <div className="absolute top-20 right-20 h-64 w-64 rounded-full border border-white/10" />
                <div className="absolute bottom-32 right-32 h-40 w-40 rounded-full border border-white/10" />
                <div className="absolute bottom-20 right-60 h-20 w-20 rounded-full bg-domain-influencing/30 blur-xl" />
                <div className="absolute top-40 right-40 h-32 w-32 rounded-full bg-domain-executing/20 blur-2xl" />
            </div>
        </div>
    );
}
