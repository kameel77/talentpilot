"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { api, tokenManager } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AddClientFlow, AddClientResume } from "@/components/clients/add-client/AddClientFlow";

function clearOnboardingCookie() {
    document.cookie = "onboarding=; path=/; max-age=0";
}

/**
 * Coach onboarding = welcome header + the same add-client flow used across the app.
 * Resumes an unfinished company setup (company without a team, or an empty team).
 */
export default function CoachWizard() {
    const t = useTranslations("onboarding.coach");
    const router = useRouter();
    const [me] = useState(() => tokenManager.getUser());

    const [loading, setLoading] = useState(true);
    const [resume, setResume] = useState<AddClientResume | undefined>(undefined);

    useEffect(() => {
        if (!me) {
            router.replace("/dashboard");
            return;
        }
        (async () => {
            try {
                const clients = await api.auth.getMyOrganizations();
                if (clients.length === 0) {
                    const individuals = (await api.users.list(undefined, me.organization_id))
                        .filter((u: { id: number }) => u.id !== me.id);
                    if (individuals.length > 0) {
                        router.replace("/dashboard");
                        return;
                    }
                    setLoading(false);
                    return;
                }

                const firstClient = clients[0];
                const teams = (await api.teams.list(firstClient.id))
                    .filter((team) => team.organization_id === firstClient.id);
                if (teams.length === 0) {
                    setResume({ orgId: firstClient.id, orgName: firstClient.name });
                    setLoading(false);
                    return;
                }
                const members = await api.users.list(teams[0].id, firstClient.id);
                if (members.length === 0) {
                    setResume({
                        orgId: firstClient.id,
                        orgName: firstClient.name,
                        teamId: teams[0].id,
                        teamName: teams[0].name,
                    });
                    setLoading(false);
                    return;
                }
                router.replace("/dashboard");
            } catch {
                setLoading(false);
            }
        })();
    }, [me, router]);

    const handleSkip = () => {
        clearOnboardingCookie();
        router.push("/dashboard");
    };

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-start justify-center px-4 py-8 sm:py-12 bg-slate-50">
            <div className="w-full max-w-xl">
                <div className="text-center mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">
                        {t("title", { name: me?.full_name || "" })}
                    </h1>
                    <p className="text-sm text-slate-500">{t("subtitle")}</p>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
                    <AddClientFlow resume={resume} onLeave={clearOnboardingCookie} />
                </div>

                <div className="text-center mt-6">
                    <Button variant="outline" onClick={handleSkip} className="text-slate-600 text-sm font-semibold">
                        {t("skip")}
                    </Button>
                </div>
            </div>
        </div>
    );
}
