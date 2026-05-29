"use client";

import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
} from "recharts";
import { useTranslations } from "next-intl";

const DOMAIN_CONFIG = [
    {
        key: "executing",
        labelKey: "domains.executing" as const,
        color: "var(--color-domain-executing)",
    },
    {
        key: "influencing",
        labelKey: "domains.influencing" as const,
        color: "var(--color-domain-influencing)",
    },
    {
        key: "relationship_building",
        labelKey: "domains.relationship_building" as const,
        color: "var(--color-domain-relationship)",
    },
    {
        key: "strategic_thinking",
        labelKey: "domains.strategic_thinking" as const,
        color: "var(--color-domain-strategic)",
    },
];

export default function DomainChart({
    talents,
}: {
    talents: { domain: string }[];
}) {
    const t = useTranslations('dashboard');
    const tTeams = useTranslations('teams');

    const data = DOMAIN_CONFIG.map((domain) => ({
        name: t(domain.labelKey),
        value: talents.filter((talent) =>
            talent.domain
                ?.toLowerCase()
                .replace(/\s+/g, "_")
                .includes(domain.key)
        ).length,
        color: domain.color,
    }));

    const hasData = data.some((item) => item.value > 0);

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                    {tTeams('gallupDomains')}
                </h3>
                <span className="text-xs uppercase tracking-wide text-slate-400">
                    {tTeams('topTalentsShort')}
                </span>
            </div>
            {hasData ? (
                <div className="mt-6 grid gap-6 md:grid-cols-[240px_1fr]">
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={48}
                                    outerRadius={78}
                                    paddingAngle={3}
                                >
                                    {data.map((entry) => (
                                        <Cell key={entry.name} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid gap-3">
                        {data.map((entry) => (
                            <div
                                key={entry.name}
                                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
                            >
                                <div className="flex items-center gap-3">
                                    <span
                                        className="h-3 w-3 rounded-full"
                                        style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-sm font-medium text-slate-700">
                                        {entry.name}
                                    </span>
                                </div>
                                <span className="text-sm font-semibold text-slate-900">
                                    {entry.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <p className="mt-6 text-sm text-slate-500">
                    {tTeams('noDomainData')}
                </p>
            )}
        </div>
    );
}
