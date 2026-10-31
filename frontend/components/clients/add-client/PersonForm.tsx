"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { api, GhostInviteResponse } from "@/lib/api";
import { getLocaleFromCookie } from "@/lib/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { parseGallupPdf, TopTalent } from "./parseGallupPdf";
import { AddedPerson, TalentChips } from "./shared";

type TalentSource = "pdf" | "invite" | "none";

export type PersonTarget = { teamId: number } | { organizationId: number };

interface PersonFormProps {
    target: PersonTarget;
    submitLabel: string;
    onAdded: (person: AddedPerson) => void;
    onChange?: () => void;
}

const INPUT_CLASS =
    "w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-slate-900";

export function PersonForm({ target, submitLabel, onAdded, onChange }: PersonFormProps) {
    const t = useTranslations("addClient");
    const fileInputId = useId();

    const [source, setSource] = useState<TalentSource>("pdf");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [rankings, setRankings] = useState<Record<string, number> | null>(null);
    const [topTalents, setTopTalents] = useState<TopTalent[]>([]);
    const [nameDetected, setNameDetected] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    // Profile already created by a previous attempt whose talent save failed —
    // a retry must not create a duplicate person.
    const [created, setCreated] = useState<GhostInviteResponse | null>(null);

    const reset = () => {
        setName("");
        setEmail("");
        setRankings(null);
        setTopTalents([]);
        setNameDetected(false);
        setCreated(null);
    };

    const handleFile = async (file: File) => {
        if (!(await api.billing.checkLimit("profiles"))) return;
        setParsing(true);
        setError("");
        setRankings(null);
        setTopTalents([]);
        try {
            const parsed = await parseGallupPdf(file, getLocaleFromCookie());
            setName(parsed.name);
            setNameDetected(parsed.nameDetected);
            setRankings(parsed.rankings);
            setTopTalents(parsed.topTalents);
        } catch {
            setError(t("pdfParseError"));
            setName(file.name.replace(/\.pdf$/i, ""));
            setNameDetected(false);
        } finally {
            setParsing(false);
        }
    };

    const emailRequired = source === "invite";
    const canSubmit =
        !busy && !parsing && name.trim().length > 0 && (!emailRequired || email.trim().length > 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        if (!created && !(await api.billing.checkLimit("profiles"))) return;
        setBusy(true);
        setError("");
        try {
            let ghost = created;
            if (!ghost) {
                ghost = await api.invitations.createGhostInvite({
                    full_name: name.trim(),
                    email: email.trim() || undefined,
                    ...("teamId" in target ? { team_id: target.teamId } : { organization_id: target.organizationId }),
                });
                setCreated(ghost);
                onChange?.();
            }

            const withTalents = source === "pdf" && rankings !== null && Object.keys(rankings).length > 0;
            if (withTalents) {
                await api.gallup.saveTalents(ghost.user_id, rankings);
            } else if (source === "invite") {
                await api.invitations.resendInvitation(ghost.user_id);
            }

            onAdded({
                userId: ghost.user_id,
                fullName: name.trim(),
                publicToken: ghost.public_token,
                publicSlug: ghost.public_slug,
                hasTalents: withTalents,
                invitedEmail: source === "invite" ? email.trim() : undefined,
            });
            reset();
        } catch {
            setError(t("error"));
        } finally {
            setBusy(false);
        }
    };

    const sourceOptions: { value: TalentSource; label: string; hint?: string }[] = [
        { value: "pdf", label: t("sourcePdf") },
        { value: "invite", label: t("sourceInvite"), hint: t("sourceInviteHint") },
        { value: "none", label: t("sourceNone"), hint: t("sourceNoneHint") },
    ];

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-700 mb-2">{t("sourcePrompt")}</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {sourceOptions.map((opt) => (
                        <label
                            key={opt.value}
                            className={cn(
                                "flex items-start gap-2 p-3 rounded-xl border cursor-pointer text-sm font-medium transition-all",
                                source === opt.value
                                    ? "border-primary bg-blue-50/60 text-primary"
                                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                            )}
                        >
                            <input
                                type="radio"
                                name={`talentSource-${fileInputId}`}
                                checked={source === opt.value}
                                onChange={() => setSource(opt.value)}
                                className="text-primary focus:ring-primary mt-0.5"
                            />
                            <span className="flex flex-col">
                                <span>{opt.label}</span>
                                {opt.hint && <span className="text-xs font-normal opacity-70">{opt.hint}</span>}
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>

            {source === "pdf" && (
                <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <label htmlFor={fileInputId} className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        {t("pdfLabel")}
                    </label>
                    <input
                        id={fileInputId}
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFile(file);
                        }}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-blue-700 cursor-pointer"
                    />
                    {parsing && (
                        <div className="flex items-center gap-2 text-xs font-medium text-primary pt-1">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("parsing")}
                        </div>
                    )}
                    {topTalents.length > 0 && (
                        <div className="pt-2 border-t border-slate-200">
                            <p className="text-xs font-semibold text-slate-500 mb-1">{t("detectedTalents")}</p>
                            <TalentChips talents={topTalents} numbered />
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                    {t("nameLabel")}
                    {nameDetected && (
                        <span className="text-xs font-normal text-emerald-600 ml-1">({t("nameDetected")})</span>
                    )}
                </label>
                <input
                    type="text"
                    required
                    placeholder={t("namePlaceholder")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={INPUT_CLASS}
                />
            </div>

            <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                    {t("emailLabel")}
                    {!emailRequired && (
                        <span className="text-xs font-normal text-slate-400 ml-1">{t("emailOptional")}</span>
                    )}
                </label>
                <input
                    type="email"
                    required={emailRequired}
                    placeholder={t("emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={INPUT_CLASS}
                />
                <p className="text-xs text-slate-400 leading-relaxed">
                    {emailRequired ? t("emailInviteHelp") : t("emailHelp")}
                </p>
            </div>

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {error}
                </div>
            )}

            <Button type="submit" disabled={!canSubmit} className="w-full py-3 font-bold">
                {busy ? t("adding") : submitLabel}
            </Button>
        </form>
    );
}
