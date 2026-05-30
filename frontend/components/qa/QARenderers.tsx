"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { QAAnswer } from "@/lib/api";
import { ResponseBlock } from "@/components/qa/QAComponents";
import { GALLUP_TALENTS, DOMAIN_CSS_KEY } from "@/lib/gallup-data";
import { cn } from "@/lib/utils";

// --- Renderer Props ---

export interface RendererProps {
    /** Raw LLM text (used by freeform and other modes) */
    answerRaw: string;
    /** Parsed structured answer (used by structured mode) */
    answer: QAAnswer;
    /** List of first names in the team to highlight */
    teamNames?: string[];
    children?: ReactNode;
}

// --- Rich Text Highlighting Helpers ---

// Create a static map of lowercased talent names to their domain CSS key and canonical name
const talentMap: Record<string, { name: string; cssKey: string }> = {};
GALLUP_TALENTS.forEach(t => {
    const cssKey = DOMAIN_CSS_KEY[t.domain] || "executing";
    talentMap[t.pl.toLowerCase()] = { name: t.pl, cssKey };
    talentMap[t.en.toLowerCase()] = { name: t.en, cssKey };
});

function isWordBoundary(char: string | undefined): boolean {
    if (!char) return true; // Start or end of string
    // Check if the character is an alphanumeric unicode letter, number or hyphen
    return !/[a-zA-Z0-9ąęćłńóśźżĄĘĆŁŃÓŚŹŻ-]/.test(char);
}

function parseTextSegment(segmentText: string, isBold: boolean, teamNames?: string[]): ReactNode {
    if (!segmentText) return "";

    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sortedTalents = Object.keys(talentMap).sort((a, b) => b.length - a.length);
    const sortedUsers = (teamNames || []).filter(u => u.length > 2).sort((a, b) => b.length - a.length);

    const patterns = [...sortedTalents.map(escapeRegExp)];
    if (sortedUsers.length > 0) {
        patterns.push(...sortedUsers.map(escapeRegExp));
    }

    const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
    const parts = segmentText.split(regex);

    if (parts.length === 1) {
        return isBold ? <strong className="font-bold text-slate-950">{segmentText}</strong> : segmentText;
    }

    return (
        <>
            {parts.map((part, index) => {
                const lowerPart = part.toLowerCase();
                const isTalent = !!talentMap[lowerPart];
                const isUser = sortedUsers.some(u => u.toLowerCase() === lowerPart);

                if (isTalent || isUser) {
                    // Check boundaries in the original split array
                    const charBefore = parts[index - 1]?.slice(-1);
                    const charAfter = parts[index + 1]?.charAt(0);

                    if (isWordBoundary(charBefore) && isWordBoundary(charAfter)) {
                        if (isTalent) {
                            const talent = talentMap[lowerPart];
                            return (
                                <span
                                    key={index}
                                    className={cn(
                                        "inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-full text-[11px] font-bold border transition-all cursor-default shadow-sm/5",
                                        `domain-${talent.cssKey}`
                                    )}
                                >
                                    {talent.name}
                                </span>
                            );
                        }
                        if (isUser) {
                            const capitalizedUser = part.charAt(0).toUpperCase() + part.slice(1);
                            return (
                                <span
                                    key={index}
                                    className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md text-[11px] font-bold bg-blue-50/70 text-blue-950 border border-blue-100/60 shadow-sm/5 transition-all"
                                >
                                    {capitalizedUser}
                                </span>
                            );
                        }
                    }
                }

                // Fallback to standard text
                return isBold ? (
                    <strong key={index} className="font-bold text-slate-950">
                        {part}
                    </strong>
                ) : (
                    part
                );
            })}
        </>
    );
}

export function formatRichText(text: string, teamNames?: string[]): ReactNode {
    // Handle **bold** markers first
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    if (parts.length === 1) {
        return parseTextSegment(text, false, teamNames);
    }

    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                    return <span key={i}>{parseTextSegment(part.slice(2, -2), true, teamNames)}</span>;
                }
                return <span key={i}>{parseTextSegment(part, false, teamNames)}</span>;
            })}
        </>
    );
}

// --- Structured Renderer (Talent / Kompetencja / Akcja boxes) ---

export function StructuredRenderer({ answer, teamNames }: RendererProps) {
    const t = useTranslations("qa");
    return (
        <div className="mt-3 space-y-3 border-t border-slate-100/80 pt-3.5">
            <ResponseBlock title={t("talent")} value={answer.talent} tone="indigo" />
            <ResponseBlock title={t("competency")} value={answer.competency} tone="blue" />
            <ResponseBlock title={t("actionsLabel")} tone="emerald">
                <ul className="list-decimal pl-5 text-sm text-slate-800 space-y-1.5 mt-2 font-medium">
                    {answer.actions.map((action, i) => (
                        <li key={i} className="pl-1 leading-relaxed">
                            {formatRichText(action, teamNames)}
                        </li>
                    ))}
                </ul>
            </ResponseBlock>
        </div>
    );
}

// --- Freeform Renderer (Markdown-like rendering of raw text) ---

export function FreeformRenderer({ answerRaw, teamNames }: RendererProps) {
    const normalizedText = (answerRaw || "").replace(/\\n/g, "\n");
    return (
        <div className="mt-3 border-t border-slate-100/80 pt-3.5 text-slate-700 leading-relaxed">
            <div className="prose prose-sm prose-slate max-w-none text-sm font-medium space-y-2">
                {normalizedText.split("\n").map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={i} className="h-2" />;

                    // Headers: e.g. ### Heading or ## Heading
                    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
                    if (headerMatch) {
                        const level = headerMatch[1].length;
                        const content = headerMatch[2];
                        return (
                            <p
                                key={i}
                                className={`font-semibold text-slate-900 mt-4 mb-1.5 ${
                                    level === 1 ? "text-base" : "text-sm"
                                }`}
                            >
                                {formatRichText(content, teamNames)}
                            </p>
                        );
                    }

                    // Bulleted lists: - Item, * Item, • Item
                    const bulletMatch = trimmed.match(/^[-•*]\s+(.*)$/);
                    if (bulletMatch) {
                        const content = bulletMatch[1];
                        return (
                            <div key={i} className="flex gap-2 ml-3 my-1 leading-relaxed text-slate-600">
                                <span className="text-blue-500 shrink-0 select-none">•</span>
                                <span className="text-sm font-medium">{formatRichText(content, teamNames)}</span>
                            </div>
                        );
                    }

                    // Numbered lists: 1. Item or 1) Item
                    const numberMatch = trimmed.match(/^(\d+)[\)\.]\s+(.*)$/);
                    if (numberMatch) {
                        const num = numberMatch[1];
                        const content = numberMatch[2];
                        return (
                            <div key={i} className="flex gap-2 ml-3 my-1 leading-relaxed text-slate-600">
                                <span className="text-blue-500 font-semibold shrink-0 select-none">{num}.</span>
                                <span className="text-sm font-medium">{formatRichText(content, teamNames)}</span>
                            </div>
                        );
                    }

                    // Blockquotes starting with >
                    const quoteMatch = trimmed.match(/^>\s*(.*)$/);
                    if (quoteMatch) {
                        const content = quoteMatch[1];
                        return (
                            <blockquote key={i} className="border-l-2 border-slate-300 pl-3 my-2 text-slate-500 italic text-sm">
                                {formatRichText(content, teamNames)}
                            </blockquote>
                        );
                    }

                    // Headers ending with colon (like **Moje zdanie**:)
                    if (trimmed.endsWith(":") && trimmed.length < 120) {
                        return (
                            <p key={i} className="font-semibold text-slate-900 mt-3.5 mb-1.5 text-sm leading-relaxed tracking-tight">
                                {formatRichText(trimmed, teamNames)}
                            </p>
                        );
                    }

                    // Regular text paragraph
                    return (
                        <p key={i} className="my-1 text-slate-600 text-sm font-medium leading-relaxed">
                            {formatRichText(trimmed, teamNames)}
                        </p>
                    );
                })}
            </div>
        </div>
    );
}

// --- Renderer Registry ---

const RENDERERS: Record<string, React.FC<RendererProps>> = {
    structured: StructuredRenderer,
    freeform: FreeformRenderer,
};

/**
 * Get the appropriate renderer component for a given render_mode.
 * Falls back to StructuredRenderer if mode is unknown.
 */
export function getRenderer(renderMode: string): React.FC<RendererProps> {
    return RENDERERS[renderMode] || RENDERERS.structured;
}
