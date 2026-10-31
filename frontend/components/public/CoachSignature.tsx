"use client";

import { Award, ExternalLink, Linkedin, Mail, Phone } from "lucide-react";
import type { PublicCoachSignature } from "@/lib/api";
import { cn } from "@/lib/utils";

type Lang = "pl" | "en";

// Public pages (/aboutme, /presentation) are rendered outside the dashboard and
// keep their own PL/EN copy, following the /aboutme page convention.
const COPY: Record<Lang, Record<string, string>> = {
    pl: {
        preparedBy: "Profil przygotował(a)",
        preparedByShort: "Przygotował(a)",
        certified: "Certyfikowany coach Gallup CliftonStrengths",
        certifiedShort: "Certyfikowany coach Gallup",
        viewCard: "Wizytówka coacha",
        gallupProfile: "Profil Gallup",
    },
    en: {
        preparedBy: "Profile prepared by",
        preparedByShort: "Prepared by",
        certified: "Certified Gallup CliftonStrengths Coach",
        certifiedShort: "Certified Gallup coach",
        viewCard: "Coach's profile",
        gallupProfile: "Gallup profile",
    },
};

/** User-supplied URLs only render as links when they are http(s) — never `javascript:` etc. */
function safeHttpUrl(url?: string | null): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
    } catch {
        return null;
    }
}

function cardUrl(handle?: string | null): string | null {
    return handle ? `/aboutme/${encodeURIComponent(handle)}` : null;
}

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("");
}

interface CoachSignatureProps {
    signature: PublicCoachSignature;
    lang?: Lang;
    className?: string;
}

/** Full "prepared by" card — client's public profile and the coach's own preview. */
export function CoachSignatureCard({ signature, lang = "pl", className }: CoachSignatureProps) {
    const t = COPY[lang];
    const url = cardUrl(signature.profile_handle);
    const linkedin = safeHttpUrl(signature.linkedin_url);
    const gallupProfile = safeHttpUrl(signature.gallup_profile_url);
    const contacts = [
        signature.email && { href: `mailto:${signature.email}`, icon: <Mail className="h-3.5 w-3.5" />, label: signature.email },
        signature.phone && { href: `tel:${signature.phone.replace(/\s+/g, "")}`, icon: <Phone className="h-3.5 w-3.5" />, label: signature.phone },
        linkedin && { href: linkedin, icon: <Linkedin className="h-3.5 w-3.5" />, label: "LinkedIn" },
        gallupProfile && { href: gallupProfile, icon: <Award className="h-3.5 w-3.5" />, label: t.gallupProfile },
    ].filter(Boolean) as { href: string; icon: React.ReactNode; label: string }[];

    return (
        <section
            className={cn(
                "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4",
                className
            )}
            aria-label={t.preparedBy}
        >
            <div className="flex items-center gap-4 flex-1 min-w-0">
                {signature.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={signature.avatar_url}
                        alt={signature.full_name}
                        className="h-14 w-14 rounded-2xl object-cover shrink-0"
                    />
                ) : (
                    <div className="h-14 w-14 rounded-2xl bg-indigo-100 text-indigo-700 font-bold text-lg flex items-center justify-center shrink-0">
                        {initials(signature.full_name)}
                    </div>
                )}
                <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t.preparedBy}</p>
                    <p className="text-lg font-bold text-slate-900 truncate">{signature.full_name}</p>
                    {signature.gallup_certified && (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                            <Award className="h-3.5 w-3.5" /> {t.certified}
                        </p>
                    )}
                    {contacts.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                            {contacts.map((c) => (
                                <a
                                    key={c.href}
                                    href={c.href}
                                    target={c.href.startsWith("http") ? "_blank" : undefined}
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600"
                                >
                                    {c.icon}
                                    <span className="truncate max-w-[220px]">{c.label}</span>
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {url && (
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition shrink-0"
                >
                    {t.viewCard}
                    <ExternalLink className="h-3.5 w-3.5" />
                </a>
            )}
        </section>
    );
}

/** Compact one-line signature — team presentation header (projected in workshops). */
export function CoachSignatureInline({ signature, lang = "pl", className }: CoachSignatureProps) {
    const t = COPY[lang];
    const url = cardUrl(signature.profile_handle);
    const name = url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-700 hover:text-indigo-600">
            {signature.full_name}
        </a>
    ) : (
        <span className="font-semibold text-slate-700">{signature.full_name}</span>
    );
    return (
        <div className={cn("text-xs text-slate-500 leading-relaxed", className)}>
            <span>{t.preparedByShort}: </span>
            {name}
            {signature.gallup_certified && (
                <span className="block sm:inline sm:ml-1 text-amber-700 font-medium">
                    <span className="hidden sm:inline">· </span>
                    {t.certifiedShort}
                </span>
            )}
        </div>
    );
}
