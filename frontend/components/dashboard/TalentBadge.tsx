"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

const domainColors: Record<string, string> = {
    executing: "var(--color-domain-executing)",
    influencing: "var(--color-domain-influencing)",
    relationship_building: "var(--color-domain-relationship)",
    strategic_thinking: "var(--color-domain-strategic)",
};

function normalizeDomain(domain?: string) {
    if (!domain) {
        return "executing";
    }
    const d = domain.toLowerCase().trim();
    if (d === 'wykonywanie') return 'executing';
    if (d === 'wpływanie' || d === 'wywieranie wpływu') return 'influencing';
    if (d === 'budowanie relacji') return 'relationship_building';
    if (d === 'myślenie strategiczne') return 'strategic_thinking';
    return d.replace(/\s+/g, "_");
}

export default function TalentBadge({
    name,
    domain,
    description,
    hideDomainLabel = false,
}: {
    name: string;
    domain?: string;
    description?: string;
    hideDomainLabel?: boolean;
}) {
    const t = useTranslations('dashboard');
    const normalized = normalizeDomain(domain);
    const color = domainColors[normalized] || "var(--color-domain-executing)";

    const domainLabelMap: Record<string, string> = {
        executing: t('domains.executing'),
        influencing: t('domains.influencing'),
        relationship_building: t('domains.relationship_building'),
        strategic_thinking: t('domains.strategic_thinking'),
    };
    const label = domainLabelMap[normalized] || normalized;

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="group/badge relative inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
        >
            <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
            />
            <span>{name}</span>
            {!hideDomainLabel && (
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                    {label}
                </span>
            )}
            {description && (
                <span className="pointer-events-none absolute -top-12 left-1/2 w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-[11px] text-slate-100 opacity-0 shadow-lg transition-opacity group-hover/badge:opacity-100 z-50">
                    {description}
                </span>
            )}
        </motion.div>
    );
}
