"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, Circle, PenLine } from "lucide-react";
import { api, tokenManager, type PublicCoachSignature, type PublicProfileSettings, type User } from "@/lib/api";
import { isPlaceholderEmail } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ToggleRow } from "@/components/settings/ToggleRow";
import { CoachSignatureCard } from "@/components/public/CoachSignature";

/**
 * Mirrors backend services/coach_signature.py so the preview shows exactly
 * what clients see (same privacy settings applied).
 */
function toSignature(user: User): PublicCoachSignature {
    const s = user.public_profile_settings ?? {};
    const showCertification = (s as { show_certification?: boolean }).show_certification ?? true;
    return {
        full_name: user.full_name,
        avatar_url: (s.show_photo ?? true) ? user.avatar_url : null,
        gallup_certified: showCertification ? Boolean(user.gallup_certified) : false,
        gallup_profile_url: showCertification ? user.gallup_profile_url : null,
        email: (s.show_email ?? true) && !isPlaceholderEmail(user.email) ? user.email : null,
        phone: (s.show_phone ?? true) ? user.phone : null,
        linkedin_url: user.linkedin_url,
        profile_handle: user.public_slug || user.public_token,
    };
}

interface CoachProfileCardProps {
    hasTalents: boolean;
}

/** "My coach profile": how the coach signs client-facing artefacts, and what is missing. */
export function CoachProfileCard({ hasTalents }: CoachProfileCardProps) {
    const t = useTranslations("coachProfile");
    const [user, setUser] = useState<User | null>(null);
    // Inline error: ToastProvider only wraps the settings section, not this page.
    const [saveError, setSaveError] = useState(false);

    useEffect(() => {
        const cached = tokenManager.getUser();
        if (!cached) return;
        api.users.get(cached.id).then(setUser).catch(() => setUser(cached));
    }, []);

    if (!user) return null;

    const enabled = user.public_profile_settings?.show_coach_signature ?? true;

    const toggleSignature = async (next: boolean) => {
        const previous = user;
        // Keys missing from a partial dict fall back to backend defaults (routers/public.py).
        const settings = {
            ...(user.public_profile_settings ?? {}),
            show_coach_signature: next,
        } as PublicProfileSettings;
        setUser({ ...user, public_profile_settings: settings });
        setSaveError(false);
        try {
            const updated = await api.users.update(user.id, { public_profile_settings: settings });
            tokenManager.setUser(updated);
            setUser(updated);
        } catch (err) {
            setUser(previous);
            setSaveError(true);
            throw err;
        }
    };

    const checks = [
        { done: Boolean(user.gallup_certified), label: t("checkCertified") },
        { done: Boolean(user.phone || user.linkedin_url), label: t("checkContact") },
        { done: Boolean(user.avatar_url), label: t("checkPhoto") },
        { done: hasTalents, label: t("checkTalents") },
    ];
    const missing = checks.filter((c) => !c.done).length;

    return (
        <Card className="p-6 border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                    <h2 className="text-title">{t("signatureTitle")}</h2>
                    <p className="text-sm text-slate-500 mt-1 max-w-2xl">{t("signatureDesc")}</p>
                </div>
                <Link
                    href="/dashboard/settings/account"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline shrink-0"
                >
                    <PenLine className="h-4 w-4" /> {t("editData")}
                </Link>
            </div>

            <div className={enabled ? "" : "opacity-50"}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">{t("previewLabel")}</p>
                <CoachSignatureCard signature={toSignature(user)} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-800 mb-2">
                        {missing === 0 ? t("checksComplete") : t("checksTitle", { count: missing })}
                    </p>
                    <ul className="space-y-1.5">
                        {checks.map((c) => (
                            <li key={c.label} className="flex items-center gap-2 text-sm">
                                {c.done ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                ) : (
                                    <Circle className="h-4 w-4 text-slate-300 shrink-0" />
                                )}
                                <span className={c.done ? "text-slate-400" : "text-slate-700"}>{c.label}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-2">
                    <ToggleRow
                        label={t("toggleLabel")}
                        description={t("toggleDesc")}
                        checked={enabled}
                        onChange={toggleSignature}
                    />
                    <Link
                        href="/dashboard/settings/public-profile"
                        className="mt-1 mb-2 inline-block text-xs font-medium text-primary hover:underline"
                    >
                        {t("privacyLink")}
                    </Link>
                    {saveError && <p className="mb-2 text-xs font-medium text-rose-600">{t("saveError")}</p>}
                </div>
            </div>
        </Card>
    );
}
