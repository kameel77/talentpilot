"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { setFirstStepFlag } from "@/lib/firstSteps";
import { DOMAIN_CSS_KEY } from "@/lib/gallup-data";
import { cn } from "@/lib/utils";
import { TopTalent } from "./parseGallupPdf";

/** A person created by the add-client flow. */
export interface AddedPerson {
    userId: number;
    fullName: string;
    publicToken?: string;
    publicSlug?: string;
    hasTalents: boolean;
    invitedEmail?: string;
}

export function profileLinkFor(person: Pick<AddedPerson, "publicSlug" | "publicToken">): string | null {
    const tokenOrSlug = person.publicSlug || person.publicToken;
    if (!tokenOrSlug || typeof window === "undefined") return null;
    return `${window.location.origin}/aboutme/${tokenOrSlug}`;
}

interface TalentChipsProps {
    talents: TopTalent[];
    numbered?: boolean;
    className?: string;
}

export function TalentChips({ talents, numbered = false, className }: TalentChipsProps) {
    if (talents.length === 0) return null;
    return (
        <div className={cn("flex flex-wrap gap-1", className)}>
            {talents.map((talent, idx) => (
                <span
                    key={talent.code}
                    className={`text-[11px] font-semibold border px-2 py-0.5 rounded-md domain-${DOMAIN_CSS_KEY[talent.domain]}`}
                >
                    {numbered ? `${idx + 1}. ` : ""}
                    {talent.name}
                </span>
            ))}
        </div>
    );
}

interface CopyProfileLinkButtonProps {
    person: Pick<AddedPerson, "publicSlug" | "publicToken">;
    label: string;
    copiedLabel: string;
    variant?: "primary" | "inline";
}

export function CopyProfileLinkButton({ person, label, copiedLabel, variant = "inline" }: CopyProfileLinkButtonProps) {
    const [copied, setCopied] = useState(false);
    const url = profileLinkFor(person);
    if (!url) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setFirstStepFlag("link_copied");
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            // Clipboard can be blocked (permissions, insecure context) — fall back to a prompt.
            window.prompt(label, url);
        }
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            className={cn(
                "inline-flex items-center justify-center gap-1.5 font-semibold transition-colors",
                variant === "primary"
                    ? "w-full py-2.5 px-4 rounded-xl text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                    : "text-xs text-primary hover:underline"
            )}
        >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? copiedLabel : label}
        </button>
    );
}

interface StepperProps {
    labels: string[];
    current: number;
    progressLabel: string;
}

/** Step indicator whose total never changes once the client type is known. */
export function Stepper({ labels, current, progressLabel }: StepperProps) {
    return (
        <div className="space-y-2" aria-label={progressLabel}>
            <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-primary">{progressLabel}</span>
                <span className="text-slate-500">{labels[current]}</span>
            </div>
            <div className="flex gap-1.5">
                {labels.map((label, idx) => (
                    <div
                        key={label}
                        className={cn(
                            "h-1.5 flex-1 rounded-full transition-colors",
                            idx <= current ? "bg-primary" : "bg-slate-200"
                        )}
                    />
                ))}
            </div>
        </div>
    );
}
