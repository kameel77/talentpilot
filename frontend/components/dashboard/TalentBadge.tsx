"use client";

import { motion } from "framer-motion";

const domainColors: Record<string, string> = {
    executing: "var(--color-domain-executing)",
    influencing: "var(--color-domain-influencing)",
    relationship_building: "var(--color-domain-relationship)",
    strategic_thinking: "var(--color-domain-strategic)",
};

const domainLabels: Record<string, string> = {
    executing: "Executing",
    influencing: "Influencing",
    relationship_building: "Relationship",
    strategic_thinking: "Strategic",
};

function normalizeDomain(domain?: string) {
    if (!domain) {
        return "executing";
    }
    return domain.toLowerCase().replace(/\s+/g, "_");
}

export default function TalentBadge({
    name,
    domain,
    description,
}: {
    name: string;
    domain?: string;
    description?: string;
}) {
    const normalized = normalizeDomain(domain);
    const color = domainColors[normalized] || "var(--color-domain-executing)";
    const label = domainLabels[normalized] || "Executing";

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="group relative inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
        >
            <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
            />
            <span>{name}</span>
            <span className="text-[10px] uppercase tracking-wide text-slate-400">
                {label}
            </span>
            {description && (
                <span className="pointer-events-none absolute -top-12 left-1/2 w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-[11px] text-slate-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    {description}
                </span>
            )}
        </motion.div>
    );
}
