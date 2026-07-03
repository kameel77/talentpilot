"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { User as UserIcon, Building, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { api, tokenManager } from "@/lib/api";
import { Button } from "@/components/ui/button";

type Step = "loading" | "clientType" | "person" | "org" | "team" | "people" | "done";
type TalentSource = "pdf" | "invite" | "none";

interface AddedPerson {
    userId: number;
    fullName: string;
}

export default function CoachWizard() {
    const t = useTranslations("onboarding.coach");
    const router = useRouter();
    const me = tokenManager.getUser();

    const [step, setStep] = useState<Step>("loading");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    // Org path context
    const [clientOrgId, setClientOrgId] = useState<number | null>(null);
    const [teamId, setTeamId] = useState<number | null>(null);
    const [addedPeople, setAddedPeople] = useState<AddedPerson[]>([]);
    // Individual path result
    const [personUserId, setPersonUserId] = useState<number | null>(null);

    // Forms
    const [orgName, setOrgName] = useState("");
    const [teamName, setTeamName] = useState("");
    const [personName, setPersonName] = useState("");
    const [personEmail, setPersonEmail] = useState("");
    const [talentSource, setTalentSource] = useState<TalentSource>("pdf");
    const [pdfFile, setPdfFile] = useState<File | null>(null);

    // Resume: derive the current step from existing data
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
                    setStep("clientType");
                    return;
                }
                // Org path in progress: resume on the first client
                const firstClient = clients[0];
                setClientOrgId(firstClient.id);
                tokenManager.setActiveOrgId(firstClient.id);
                const teams = await api.teams.list(firstClient.id);
                const clientTeams = teams.filter((team) => team.organization_id === firstClient.id);
                if (clientTeams.length === 0) {
                    setStep("team");
                    return;
                }
                setTeamId(clientTeams[0].id);
                const members = await api.users.list(clientTeams[0].id, firstClient.id);
                if (members.length === 0) {
                    setStep("people");
                    return;
                }
                router.replace("/dashboard");
            } catch {
                setStep("clientType");
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSkip = () => {
        document.cookie = "onboarding=; path=/; max-age=0";
        router.push("/dashboard");
    };

    const submitPerson = async (targetTeamId: number | null) => {
        if (!me) return;
        setBusy(true);
        setError("");
        try {
            const payload = targetTeamId
                ? { email: personEmail, full_name: personName, team_id: targetTeamId }
                : { email: personEmail, full_name: personName, organization_id: me.organization_id };
            const ghost = await api.invitations.createGhostInvite(payload);

            if (talentSource === "pdf" && pdfFile) {
                const parsed = await api.gallup.parsePdf(pdfFile);
                await api.gallup.saveTalents(ghost.user_id, parsed.rankings);
            } else if (talentSource === "invite") {
                await api.invitations.resendInvitation(ghost.user_id);
            }

            if (targetTeamId) {
                setAddedPeople((prev) => [...prev, { userId: ghost.user_id, fullName: personName }]);
            } else {
                setPersonUserId(ghost.user_id);
                setStep("done");
            }
            setPersonName("");
            setPersonEmail("");
            setPdfFile(null);
        } catch {
            setError(t("error"));
        } finally {
            setBusy(false);
        }
    };

    const submitOrg = async () => {
        setBusy(true);
        setError("");
        try {
            const org = await api.organizations.create({ name: orgName });
            setClientOrgId(org.id);
            tokenManager.setActiveOrgId(org.id);
            setStep("team");
        } catch {
            setError(t("error"));
        } finally {
            setBusy(false);
        }
    };

    const submitTeam = async () => {
        if (!clientOrgId) return;
        setBusy(true);
        setError("");
        try {
            const team = await api.teams.create({ name: teamName, organization_id: clientOrgId });
            setTeamId(team.id);
            setStep("people");
        } catch {
            setError(t("error"));
        } finally {
            setBusy(false);
        }
    };

    const handleFinish = () => {
        document.cookie = "onboarding=; path=/; max-age=0";
        if (teamId) {
            router.push(`/dashboard/teams/${teamId}`);
        } else if (personUserId) {
            router.push(`/dashboard/users/${personUserId}`);
        } else {
            router.push("/dashboard");
        }
    };

    if (step === "loading") {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    const personForm = (targetTeamId: number | null) => (
        <div className="space-y-4">
            <input
                type="text" required placeholder={t("personFullName")}
                value={personName} onChange={(e) => setPersonName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            />
            <input
                type="email" required placeholder={t("personEmail")}
                value={personEmail} onChange={(e) => setPersonEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            />
            <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">{t("talentSource")}</p>
                {(["pdf", "invite", "none"] as TalentSource[]).map((src) => (
                    <label key={src} className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                            type="radio" name="talentSource" checked={talentSource === src}
                            onChange={() => setTalentSource(src)}
                        />
                        {src === "pdf" ? t("talentPdf") : src === "invite" ? t("talentInvite") : t("talentNone")}
                    </label>
                ))}
            </div>
            {talentSource === "pdf" && (
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-700">{t("pdfFile")}</p>
                    <input
                        type="file" accept="application/pdf"
                        onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-500"
                    />
                </div>
            )}
            <Button
                onClick={() => submitPerson(targetTeamId)}
                disabled={busy || !personName || !personEmail || (talentSource === "pdf" && !pdfFile)}
            >
                {busy ? t("adding") : t("addPerson")}
            </Button>
        </div>
    );

    return (
        <div className="flex min-h-screen items-start justify-center px-6 py-12 bg-slate-50">
            <div className="w-full max-w-xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        {t("title", { name: me?.full_name || "" })}
                    </h1>
                    <p className="text-slate-500">{t("subtitle")}</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
                    {step === "clientType" && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-slate-800">{t("stepClientType")}</h2>
                            <button
                                onClick={() => setStep("person")}
                                className="w-full flex items-center gap-4 p-5 rounded-xl border border-slate-200 hover:border-primary text-left transition"
                            >
                                <UserIcon className="w-8 h-8 text-purple-600 shrink-0" />
                                <div>
                                    <div className="font-semibold text-slate-800">{t("clientPerson")}</div>
                                    <div className="text-sm text-slate-500">{t("clientPersonDesc")}</div>
                                </div>
                            </button>
                            <button
                                onClick={() => setStep("org")}
                                className="w-full flex items-center gap-4 p-5 rounded-xl border border-slate-200 hover:border-primary text-left transition"
                            >
                                <Building className="w-8 h-8 text-blue-600 shrink-0" />
                                <div>
                                    <div className="font-semibold text-slate-800">{t("clientOrg")}</div>
                                    <div className="text-sm text-slate-500">{t("clientOrgDesc")}</div>
                                </div>
                            </button>
                        </div>
                    )}

                    {step === "person" && personForm(null)}

                    {step === "org" && (
                        <div className="space-y-4">
                            <input
                                type="text" required placeholder={t("orgName")}
                                value={orgName} onChange={(e) => setOrgName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                            <Button onClick={submitOrg} disabled={busy || !orgName}>
                                {busy ? t("adding") : t("createOrg")}
                            </Button>
                        </div>
                    )}

                    {step === "team" && (
                        <div className="space-y-4">
                            <input
                                type="text" required placeholder={t("teamName")}
                                value={teamName} onChange={(e) => setTeamName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                            <Button onClick={submitTeam} disabled={busy || !teamName}>
                                {busy ? t("adding") : t("createTeam")}
                            </Button>
                        </div>
                    )}

                    {step === "people" && (
                        <div className="space-y-6">
                            <h2 className="text-lg font-bold text-slate-800">{t("peopleTitle")}</h2>
                            {addedPeople.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold text-slate-700">{t("peopleAdded")}</p>
                                    {addedPeople.map((p) => (
                                        <div key={p.userId} className="flex items-center gap-2 text-sm text-slate-600">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {p.fullName}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {personForm(teamId)}
                            {addedPeople.length > 0 && (
                                <Button variant="outline" onClick={handleFinish} className="w-full">
                                    {t("finishToMatrix")} <ArrowRight className="w-4 h-4 ml-1" />
                                </Button>
                            )}
                        </div>
                    )}

                    {step === "done" && (
                        <div className="text-center space-y-4">
                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                            <Button onClick={handleFinish}>
                                {t("finishToProfile")} <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    )}

                    {error && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                            {error}
                        </div>
                    )}
                </div>

                <div className="text-center mt-6">
                    <button onClick={handleSkip} className="text-sm text-slate-400 hover:text-slate-600 underline">
                        {t("skip")}
                    </button>
                </div>
            </div>
        </div>
    );
}
