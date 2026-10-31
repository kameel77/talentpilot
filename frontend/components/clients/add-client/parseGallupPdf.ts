import { api } from "@/lib/api";
import { GALLUP_TALENTS, GallupDomain } from "@/lib/gallup-data";
import { Locale } from "@/lib/locale";

export interface TopTalent {
    code: string;
    name: string;
    domain: GallupDomain;
}

export interface ParsedGallupPdf {
    /** Full name detected in the report, or the file name without extension. */
    name: string;
    /** True when the name came from the report itself, not from the file name. */
    nameDetected: boolean;
    rankings: Record<string, number>;
    topTalents: TopTalent[];
}

export function fileBaseName(file: File): string {
    return file.name.replace(/\.pdf$/i, "");
}

export function isPdfFile(file: File): boolean {
    return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

// Talent names come from the frontend SSoT (`gallup-data`). Note: the backend's
// `translated_rankings` is keyed by translated name, not by code, so it is not used here.
function resolveTalent(code: string, locale: Locale): TopTalent {
    const gt = GALLUP_TALENTS.find((g) => g.code === code);
    return {
        code,
        name: gt ? (locale === "en" ? gt.en : gt.pl) : code,
        domain: gt?.domain ?? "executing",
    };
}

/**
 * Parse a Gallup CliftonStrengths PDF for a profile that does not exist yet.
 * Uses intent="new_profile", so the backend enforces the plan limit here.
 */
export async function parseGallupPdf(file: File, locale: Locale): Promise<ParsedGallupPdf> {
    const parsed = await api.gallup.parsePdf(file, locale, "new_profile");
    const rankings: Record<string, number> = parsed.rankings || {};
    const detected = `${parsed.first_name || ""} ${parsed.last_name || ""}`.trim();
    const topTalents = Object.entries(rankings)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 5)
        .map(([code]) => resolveTalent(code, locale));

    return {
        name: detected || fileBaseName(file),
        nameDetected: Boolean(detected),
        rankings,
        topTalents,
    };
}
