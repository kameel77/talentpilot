"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { api, tokenManager } from "@/lib/api";
import { ArrowRight, FileText, Users, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const ONBOARDING_COOKIE = "onboarding";

function getOnboardingCookie(): boolean {
    if (typeof document === "undefined") return false;
    return document.cookie.split(";").some((c) => c.trim().startsWith(`${ONBOARDING_COOKIE}=`));
}

function clearOnboardingCookie() {
    document.cookie = `${ONBOARDING_COOKIE}=; path=/; max-age=0`;
}

export default function OnboardingPage() {
    const t = useTranslations("onboarding");
    const router = useRouter();
    const [teamName, setTeamName] = useState("");

    useEffect(() => {
        if (!getOnboardingCookie()) {
            router.replace("/dashboard");
            return;
        }

        const user = tokenManager.getUser();
        void user; // userName not shown in title but available

        api.teams.list().then((teams) => {
            if (teams.length > 0) setTeamName(teams[0].name);
        });
    }, [router]);

    const handleGetStarted = () => {
        clearOnboardingCookie();
        router.push("/dashboard");
    };

    const steps = [
        {
            icon: <FileText className="w-6 h-6 text-purple-600" />,
            title: t("step1Title"),
            cta: t("step1Cta"),
            href: "/dashboard/my-talents",
        },
        {
            icon: <Users className="w-6 h-6 text-blue-600" />,
            title: t("step2Title"),
            cta: t("step2Cta"),
            href: "/dashboard/teams",
        },
        {
            icon: <MessageSquare className="w-6 h-6 text-green-600" />,
            title: t("step3Title"),
            cta: t("step3Cta"),
            href: "/dashboard/qa",
        },
    ];

    return (
        <div className="flex min-h-screen items-center justify-center px-6 py-12 bg-slate-50">
            <div className="w-full max-w-lg">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        {t("title")}
                    </h1>
                    {teamName && (
                        <p className="text-slate-500 text-lg">
                            {t("subtitle", { teamName })}
                        </p>
                    )}
                </div>

                <div className="space-y-4 mb-8">
                    {steps.map((step, i) => (
                        <div
                            key={i}
                            className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between gap-4"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                                    {step.icon}
                                </div>
                                <div>
                                    <div className="font-semibold text-slate-800">{i + 1}. {step.title}</div>
                                </div>
                            </div>
                            <Link
                                href={step.href}
                                className="text-sm font-medium text-purple-600 hover:text-purple-700 whitespace-nowrap flex items-center gap-1"
                                onClick={clearOnboardingCookie}
                            >
                                {step.cta}
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    ))}
                </div>

                <div className="text-center">
                    <Button onClick={handleGetStarted} size="lg" className="px-8">
                        {t("cta")}
                    </Button>
                </div>
            </div>
        </div>
    );
}
