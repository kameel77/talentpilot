"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { User as UserIcon, Building, ArrowRight, Loader2, CheckCircle2, Upload, Trash2, Copy, Check } from "lucide-react";
import { api, tokenManager } from "@/lib/api";
import { GALLUP_TALENTS, DOMAIN_CSS_KEY, GallupDomain } from "@/lib/gallup-data";
import { Button } from "@/components/ui/button";
import { getLocaleFromCookie } from "@/lib/locale";

type Step = "loading" | "clientType" | "person" | "org" | "team" | "people" | "done";
type TalentSource = "pdf" | "invite" | "none";

interface AddedPerson {
    userId: number;
    fullName: string;
    publicToken?: string;
    publicSlug?: string;
}

interface BulkPdfItem {
    file: File;
    name: string;
    status: "parsing" | "success" | "error";
    rankings?: Record<string, number>;
    topTalents?: { code: string; name: string }[];
    error?: string;
}

export default function CoachWizard() {
    const t = useTranslations("onboarding.coach");
    const router = useRouter();
    const me = tokenManager.getUser();
    const locale = getLocaleFromCookie() || "pl";

    const [step, setStep] = useState<Step>("loading");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [parsingPdf, setParsingPdf] = useState(false);

    // Org path context
    const [clientOrgId, setClientOrgId] = useState<number | null>(null);
    const [teamId, setTeamId] = useState<number | null>(null);
    const [addedPeople, setAddedPeople] = useState<AddedPerson[]>([]);
    const [personUser, setPersonUser] = useState<{ id: number; fullName: string; token?: string; slug?: string } | null>(null);

    // Form state
    const [orgName, setOrgName] = useState("");
    const [teamName, setTeamName] = useState("");
    const [personName, setPersonName] = useState("");
    const [personEmail, setPersonEmail] = useState("");
    const [talentSource, setTalentSource] = useState<TalentSource>("pdf");
    const [parsedRankings, setParsedRankings] = useState<Record<string, number> | null>(null);
    const [topTalentsPreview, setTopTalentsPreview] = useState<{ code: string; name: string }[]>([]);
    
    // Bulk PDF state (E1)
    const [bulkPdfItems, setBulkPdfItems] = useState<BulkPdfItem[]>([]);
    const [copiedLink, setCopiedLink] = useState(false);

    // Helper for human-readable talent names
    const resolveTalentName = (code: string, translatedMap?: Record<string, string>): string => {
        if (translatedMap && translatedMap[code]) {
            return translatedMap[code];
        }
        const found = GALLUP_TALENTS.find((gt) => gt.code === code);
        if (found) {
            return locale === "en" ? found.en : found.pl;
        }
        return code;
    };

    // Helper to resolve a talent's domain (for colouring badges)
    const resolveTalentDomain = (code: string): GallupDomain => {
        return GALLUP_TALENTS.find((gt) => gt.code === code)?.domain || "executing";
    };

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

    // Instant PDF parser for single file
    const handlePdfSelect = async (file: File) => {
        setParsingPdf(true);
        setError("");
        try {
            const parsed = await api.gallup.parsePdf(file);
            const detectedName = `${parsed.first_name || ""} ${parsed.last_name || ""}`.trim() || file.name.replace(/\.pdf$/i, "");
            setPersonName(detectedName);
            setParsedRankings(parsed.rankings || null);

            // Extract top 5 talents (code + display name) for preview
            const sorted = Object.entries(parsed.rankings || {})
                .sort((a, b) => (a[1] as number) - (b[1] as number))
                .slice(0, 5)
                .map(([code]) => ({ code, name: resolveTalentName(code, parsed.translated_rankings) }));
            setTopTalentsPreview(sorted);
        } catch {
            setError(t("pdfParseError"));
            setPersonName(file.name.replace(/\.pdf$/i, ""));
        } finally {
            setParsingPdf(false);
        }
    };

    // Bulk PDF handler (E1)
    const handleBulkPdfSelect = async (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        const initialItems: BulkPdfItem[] = fileArray.map((f) => ({
            file: f,
            name: f.name.replace(/\.pdf$/i, ""),
            status: "parsing",
        }));
        setBulkPdfItems((prev) => [...prev, ...initialItems]);

        for (let i = 0; i < fileArray.length; i++) {
            const file = fileArray[i];
            try {
                const parsed = await api.gallup.parsePdf(file);
                const detectedName = `${parsed.first_name || ""} ${parsed.last_name || ""}`.trim() || file.name.replace(/\.pdf$/i, "");
                const sorted = Object.entries(parsed.rankings || {})
                    .sort((a, b) => (a[1] as number) - (b[1] as number))
                    .slice(0, 5)
                    .map(([code]) => ({ code, name: resolveTalentName(code, parsed.translated_rankings) }));

                setBulkPdfItems((prev) =>
                    prev.map((item) =>
                        item.file === file
                            ? {
                                  ...item,
                                  name: detectedName,
                                  status: "success",
                                  rankings: parsed.rankings,
                                  topTalents: sorted,
                              }
                            : item
                    )
                );
            } catch {
                setBulkPdfItems((prev) =>
                    prev.map((item) =>
                        item.file === file
                            ? {
                                  ...item,
                                  status: "error",
                                  error: t("pdfParseError"),
                              }
                            : item
                    )
                );
            }
        }
    };

    const submitPerson = async (targetTeamId: number | null) => {
        if (!me) return;
        setBusy(true);
        setError("");
        try {
            const payload = targetTeamId
                ? { email: personEmail || undefined, full_name: personName, team_id: targetTeamId }
                : { email: personEmail || undefined, full_name: personName, organization_id: me.organization_id };
            const ghost = await api.invitations.createGhostInvite(payload);

            if (talentSource === "pdf" && parsedRankings) {
                await api.gallup.saveTalents(ghost.user_id, parsedRankings);
            } else if (talentSource === "invite") {
                await api.invitations.resendInvitation(ghost.user_id);
            }

            if (targetTeamId) {
                setAddedPeople((prev) => [
                    ...prev,
                    {
                        userId: ghost.user_id,
                        fullName: personName,
                        publicToken: ghost.public_token,
                        publicSlug: ghost.public_slug,
                    },
                ]);
            } else {
                setPersonUser({
                    id: ghost.user_id,
                    fullName: personName,
                    token: ghost.public_token,
                    slug: ghost.public_slug,
                });
                setStep("done");
            }
            setPersonName("");
            setPersonEmail("");
            setParsedRankings(null);
            setTopTalentsPreview([]);
        } catch {
            setError(t("error"));
        } finally {
            setBusy(false);
        }
    };

    const submitBulkPeople = async () => {
        if (!me || !teamId) return;
        setBusy(true);
        setError("");
        try {
            for (const item of bulkPdfItems) {
                if (item.status !== "success") continue;
                const payload = { email: undefined, full_name: item.name, team_id: teamId };
                const ghost = await api.invitations.createGhostInvite(payload);
                if (item.rankings) {
                    await api.gallup.saveTalents(ghost.user_id, item.rankings);
                }
                setAddedPeople((prev) => [
                    ...prev,
                    {
                        userId: ghost.user_id,
                        fullName: item.name,
                        publicToken: ghost.public_token,
                        publicSlug: ghost.public_slug,
                    },
                ]);
            }
            setBulkPdfItems([]);
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
        } else if (personUser) {
            router.push(`/dashboard/users/${personUser.id}`);
        } else {
            router.push("/dashboard");
        }
    };

    const handleCopyProfileLink = (tokenOrSlug?: string) => {
        if (!tokenOrSlug) return;
        const url = `${window.location.origin}/aboutme/${tokenOrSlug}`;
        navigator.clipboard.writeText(url);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
    };

    if (step === "loading") {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    const getStepProgress = () => {
        switch (step) {
            case "clientType":
                return { current: 1, total: 3, label: t("clientPerson") };
            case "person":
                return { current: 2, total: 3, label: t("personFullName") };
            case "org":
                return { current: 2, total: 4, label: t("orgName") };
            case "team":
                return { current: 3, total: 4, label: t("teamName") };
            case "people":
                return { current: 4, total: 4, label: t("peopleTitle") };
            case "done":
                return { current: 3, total: 3, label: t("clientAddedTitle") };
            default:
                return { current: 1, total: 3, label: "" };
        }
    };

    const progress = getStepProgress();

    const personForm = (targetTeamId: number | null) => (
        <div className="space-y-5">
            <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700">{t("talentSourcePrompt")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label
                        className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer text-sm font-medium transition-all ${
                            talentSource === "pdf"
                                ? "border-primary bg-blue-50/60 text-primary"
                                : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                    >
                        <input
                            type="radio"
                            name="talentSource"
                            checked={talentSource === "pdf"}
                            onChange={() => setTalentSource("pdf")}
                            className="text-primary focus:ring-primary"
                        />
                        {t("talentSourcePdf")}
                    </label>

                    <label
                        className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer text-sm font-medium transition-all ${
                            talentSource === "invite"
                                ? "border-primary bg-blue-50/60 text-primary"
                                : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                    >
                        <input
                            type="radio"
                            name="talentSource"
                            checked={talentSource === "invite"}
                            onChange={() => setTalentSource("invite")}
                            className="text-primary focus:ring-primary mt-0.5"
                        />
                        <span className="flex flex-col">
                            <span>{t("talentSourceInvite")}</span>
                            <span className="text-xs font-normal opacity-70">{t("talentSourceInviteHint")}</span>
                        </span>
                    </label>

                    <label
                        className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer text-sm font-medium transition-all ${
                            talentSource === "none"
                                ? "border-primary bg-blue-50/60 text-primary"
                                : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                    >
                        <input
                            type="radio"
                            name="talentSource"
                            checked={talentSource === "none"}
                            onChange={() => setTalentSource("none")}
                            className="text-primary focus:ring-primary mt-0.5"
                        />
                        <span className="flex flex-col">
                            <span>{t("talentSourceManual")}</span>
                            <span className="text-xs font-normal opacity-70">{t("talentSourceManualHint")}</span>
                        </span>
                    </label>
                </div>
            </div>

            {talentSource === "pdf" && (
                <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        {t("uploadPdfTitle")}
                    </p>
                    <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePdfSelect(file);
                        }}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-blue-700 cursor-pointer"
                    />
                    {parsingPdf && (
                        <div className="flex items-center gap-2 text-xs font-medium text-primary pt-1">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("parsingPdf")}
                        </div>
                    )}
                    {topTalentsPreview.length > 0 && (
                        <div className="pt-2 border-t border-slate-200">
                            <p className="text-xs font-semibold text-slate-500 mb-1">
                                {t("detectedTalents")}
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {topTalentsPreview.map((talent, idx) => (
                                    <span
                                        key={talent.code}
                                        className={`text-[11px] font-semibold border px-2 py-0.5 rounded-md domain-${DOMAIN_CSS_KEY[resolveTalentDomain(talent.code)]}`}
                                    >
                                        {idx + 1}. {talent.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                    {t("personFullName")} {parsedRankings && <span className="text-xs font-normal text-emerald-600 ml-1">({t("personNameDetected")})</span>}
                </label>
                <input
                    type="text"
                    required
                    placeholder="np. Anna Kowalska"
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-slate-900"
                />
            </div>

            <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                    {t("personEmail")} {talentSource !== "invite" && <span className="text-xs font-normal text-slate-400 ml-1">{t("personEmailOptional")}</span>}
                </label>
                <input
                    type="email"
                    required={talentSource === "invite"}
                    placeholder="jan@firma.pl"
                    value={personEmail}
                    onChange={(e) => setPersonEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-slate-900"
                />
                <p className="text-xs text-slate-400 leading-relaxed">
                    {t("personEmailHelp")}
                </p>
            </div>

            <Button
                onClick={() => submitPerson(targetTeamId)}
                disabled={busy || parsingPdf || !personName.trim() || (talentSource === "invite" && !personEmail.trim())}
                className="w-full py-3 font-bold"
            >
                {busy ? t("adding") : t("addPerson")}
            </Button>
        </div>
    );

    return (
        <div className="flex min-h-screen items-start justify-center px-4 py-8 sm:py-12 bg-slate-50">
            <div className="w-full max-w-xl">
                {/* Header with progress */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 bg-blue-100/60 text-blue-700 px-3 py-1 rounded-full text-xs font-bold mb-3">
                        {t("stepProgress", { current: progress.current, total: progress.total, label: progress.label })}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">
                        {t("title", { name: me?.full_name || "" })}
                    </h1>
                    <p className="text-sm text-slate-500">{t("subtitle")}</p>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
                    {step === "clientType" && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-slate-800">{t("stepClientType")}</h2>
                            
                            <button
                                onClick={() => setStep("person")}
                                className="w-full flex items-center gap-4 p-5 rounded-2xl border border-slate-200 hover:border-primary hover:bg-purple-50/40 text-left transition group"
                            >
                                <div className="h-12 w-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                                    <UserIcon className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-800">{t("clientPerson")}</div>
                                    <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{t("clientPersonDesc")}</div>
                                </div>
                                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                            </button>

                            <button
                                onClick={() => setStep("org")}
                                className="w-full flex items-center gap-4 p-5 rounded-2xl border border-slate-200 hover:border-primary hover:bg-blue-50/40 text-left transition group"
                            >
                                <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                    <Building className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-800">{t("clientOrg")}</div>
                                    <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{t("clientOrgDesc")}</div>
                                </div>
                                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                            </button>
                        </div>
                    )}

                    {step === "person" && personForm(null)}

                    {step === "org" && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-slate-800">{t("orgName")}</h2>
                            <input
                                type="text"
                                required
                                placeholder={t("orgName")}
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-slate-900"
                            />
                            <Button onClick={submitOrg} disabled={busy || !orgName.trim()} className="w-full py-3 font-bold">
                                {busy ? t("adding") : t("createOrg")}
                            </Button>
                        </div>
                    )}

                    {step === "team" && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-slate-800">{t("teamName")}</h2>
                            <input
                                type="text"
                                required
                                placeholder={t("teamName")}
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-slate-900"
                            />
                            <Button onClick={submitTeam} disabled={busy || !teamName.trim()} className="w-full py-3 font-bold">
                                {busy ? t("adding") : t("createTeam")}
                            </Button>
                        </div>
                    )}

                    {step === "people" && (
                        <div className="space-y-6">
                            <h2 className="text-lg font-bold text-slate-800">{t("peopleTitle")}</h2>

                            {/* Bulk PDF drop zone (E1) */}
                            <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl text-center hover:border-primary transition-colors">
                                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                <p className="text-sm font-semibold text-slate-700">
                                    {t("bulkPdfTitle")}
                                </p>
                                <p className="text-xs text-slate-400 mb-3">
                                    {t("bulkPdfHelp")}
                                </p>
                                <input
                                    type="file"
                                    multiple
                                    accept="application/pdf"
                                    onChange={(e) => {
                                        if (e.target.files) handleBulkPdfSelect(e.target.files);
                                    }}
                                    className="hidden"
                                    id="bulk-pdf-input"
                                />
                                <label
                                    htmlFor="bulk-pdf-input"
                                    className="inline-flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                                >
                                    {t("selectPdfFiles")}
                                </label>
                            </div>

                            {/* Bulk list review */}
                            {bulkPdfItems.length > 0 && (
                                <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        {t("detectedFiles", { count: bulkPdfItems.length })}
                                    </p>
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                        {bulkPdfItems.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between gap-3 p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
                                            >
                                                {item.status === "parsing" ? (
                                                    <div className="flex items-center gap-2 text-slate-500">
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> {item.file.name}
                                                    </div>
                                                ) : item.status === "success" ? (
                                                    <div className="flex-1 min-w-0">
                                                        <input
                                                            type="text"
                                                            value={item.name}
                                                            onChange={(e) => {
                                                                const newName = e.target.value;
                                                                setBulkPdfItems((prev) =>
                                                                    prev.map((it, i) => (i === idx ? { ...it, name: newName } : it))
                                                                );
                                                            }}
                                                            className="font-bold text-slate-900 bg-transparent border-b border-slate-200 focus:border-primary outline-none w-full"
                                                        />
                                                        {item.topTalents && item.topTalents.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {item.topTalents.slice(0, 3).map((talent) => (
                                                                    <span
                                                                        key={talent.code}
                                                                        className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded-md domain-${DOMAIN_CSS_KEY[resolveTalentDomain(talent.code)]}`}
                                                                    >
                                                                        {talent.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-rose-600 font-medium">
                                                        {item.file.name}: {item.error}
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() =>
                                                        setBulkPdfItems((prev) => prev.filter((_, i) => i !== idx))
                                                    }
                                                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <Button
                                        onClick={submitBulkPeople}
                                        disabled={busy || bulkPdfItems.every((i) => i.status !== "success")}
                                        className="w-full py-2.5 font-bold text-xs"
                                    >
                                        {busy ? t("savingBulk") : t("addAllBulk", { count: bulkPdfItems.filter((i) => i.status === "success").length })}
                                    </Button>
                                </div>
                            )}

                            {addedPeople.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold text-slate-700">{t("peopleAdded")}</p>
                                    {addedPeople.map((p) => (
                                        <div key={p.userId} className="flex items-center justify-between text-sm text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {p.fullName}
                                            </div>
                                            {(p.publicSlug || p.publicToken) && (
                                                <button
                                                    onClick={() => handleCopyProfileLink(p.publicSlug || p.publicToken)}
                                                    className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                                                >
                                                    <Copy className="w-3 h-3" /> Link
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="border-t border-slate-200 pt-4">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                    {t("orAddIndividual")}
                                </p>
                                {personForm(teamId)}
                            </div>

                            {addedPeople.length > 0 && (
                                <Button variant="outline" onClick={handleFinish} className="w-full py-3 font-bold">
                                    {t("finishToMatrix")} <ArrowRight className="w-4 h-4 ml-1" />
                                </Button>
                            )}
                        </div>
                    )}

                    {step === "done" && (
                        <div className="text-center space-y-5">
                            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 mb-1">{t("clientAddedTitle")}</h2>
                                <p className="text-sm text-slate-500">{t("clientAddedSubtitle")}</p>
                            </div>

                            {/* Share link action (E4) */}
                            {(personUser?.token || personUser?.slug) && (
                                <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-2">
                                    <p className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                                        {t("clientProfileLinkTitle")}
                                    </p>
                                    <p className="text-xs text-purple-700">
                                        {t("clientProfileLinkHelp")}
                                    </p>
                                    <button
                                        onClick={() => handleCopyProfileLink(personUser.slug || personUser.token)}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-md transition-all"
                                    >
                                        {copiedLink ? (
                                            <>
                                                <Check className="w-4 h-4 text-emerald-300" /> {t("copiedLink")}
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" /> {t("copyProfileLink")}
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            <Button onClick={handleFinish} className="w-full py-3 font-bold">
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

                {/* Secondary Skip button (E2) */}
                <div className="text-center mt-6">
                    <Button
                        variant="ghost"
                        onClick={handleSkip}
                        className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                    >
                        {t("skip")} ({t("skipToDashboard")})
                    </Button>
                </div>
            </div>
        </div>
    );
}
