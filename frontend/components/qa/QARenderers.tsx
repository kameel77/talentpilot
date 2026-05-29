"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { QAAnswer } from "@/lib/api";
import { ResponseBlock } from "@/components/qa/QAComponents";

// --- Renderer Props ---

export interface RendererProps {
    /** Raw LLM text (used by freeform and other modes) */
    answerRaw: string;
    /** Parsed structured answer (used by structured mode) */
    answer: QAAnswer;
    children?: ReactNode;
}

// --- Structured Renderer (Talent / Kompetencja / Akcja boxes) ---

export function StructuredRenderer({ answer }: RendererProps) {
    const t = useTranslations("qa");
    return (
        <div className="mt-4 space-y-3">
            <ResponseBlock title={t("talent")} value={answer.talent} tone="indigo" />
            <ResponseBlock title={t("competency")} value={answer.competency} tone="blue" />
            <ResponseBlock title={t("actionsLabel")} tone="emerald">
                <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                    {answer.actions.map((action, i) => (
                        <li key={i}>{action}</li>
                    ))}
                </ul>
            </ResponseBlock>
        </div>
    );
}

// --- Freeform Renderer (Markdown-like rendering of raw text) ---

export function FreeformRenderer({ answerRaw }: RendererProps) {
    return (
        <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white px-5 py-4">
            <div className="prose prose-sm prose-slate max-w-none">
                {answerRaw.split("\n").map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <br key={i} />;

                    // Headers (lines ending with colon or starting with bold markers)
                    if (trimmed.endsWith(":") && trimmed.length < 80) {
                        return (
                            <p key={i} className="font-semibold text-slate-900 mt-3 mb-1">
                                {formatInlineMarkdown(trimmed)}
                            </p>
                        );
                    }

                    // Numbered or bulleted list items
                    const listMatch = trimmed.match(/^(\d+[\)\.]\s*|[-•*]\s*)(.*)/);
                    if (listMatch) {
                        return (
                            <div key={i} className="flex gap-2 ml-2 my-0.5">
                                <span className="text-slate-400 shrink-0">{listMatch[1].trim()}</span>
                                <span>{formatInlineMarkdown(listMatch[2])}</span>
                            </div>
                        );
                    }

                    // Regular text
                    return (
                        <p key={i} className="my-1 leading-relaxed">
                            {formatInlineMarkdown(trimmed)}
                        </p>
                    );
                })}
            </div>
        </div>
    );
}

// --- Inline markdown helper (bold text) ---

function formatInlineMarkdown(text: string): ReactNode {
    // Handle **bold** markers
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    if (parts.length === 1) return text;

    return parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return (
                <strong key={i} className="font-semibold text-slate-900">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        return part;
    });
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
