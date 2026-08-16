"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GALLUP_TALENTS, getDomainStyle, DOMAIN_LABELS, GallupDomain, getTalentsByDomain } from '@/lib/gallup-data';
import { getLocaleFromCookie } from '@/lib/locale';
import { Talent } from '@/lib/api';
import {
    teamTalentRanks, teamDomainScores, findTeamWeaknesses, findSPOF,
    teamResilience, uniqueContributions, complementaryPairs,
} from '@/lib/team-algorithms';
import { Grid3x3, PieChart, Search, BarChart3 } from 'lucide-react';
import {
    PieChart as RePieChart, Pie, Cell, ResponsiveContainer,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
    Tooltip,
} from 'recharts';
import TeamRankList from '@/components/dashboard/TeamRankList';
import TalentHeatmap from '@/components/dashboard/TalentHeatmap';
import TeamRisks from '@/components/dashboard/TeamRisks';
import UniqueContributions from '@/components/dashboard/UniqueContributions';
import ComplementaryPairs from '@/components/dashboard/ComplementaryPairs';
import MemberProfileCards from '@/components/dashboard/MemberProfileCards';

interface TalentResult {
    id: string | number;
    rank: number;
    talent: string;
    domain: string;
}

interface Member {
    id: string | number;
    name: string;
    role?: string;
    results: TalentResult[];
}

interface MatrixDashboardProps {
    members: Member[];
    canSeeRisks?: boolean;
    talents?: Talent[];
}

export default function MatrixDashboard({ members, canSeeRisks = false, talents }: MatrixDashboardProps) {
    const t = useTranslations('teams');
    const locale = getLocaleFromCookie();

    const [activeTab, setActiveTab] = useState<'matrix' | 'domains' | 'profiles'>('matrix');
    const [matrixSearch, setMatrixSearch] = useState('');
    const [showTop15Domains, setShowTop15Domains] = useState(true);
    const [showTop15Profiles, setShowTop15Profiles] = useState(true);
    const talentInfoByCode = new Map((talents ?? []).map(t => [t.code, t]));
    const [headerTooltip, setHeaderTooltip] = useState<{
        code: string;
        x: number;
        y: number;
    } | null>(null);

    const membersWithResults = (members || []).filter(m => (m?.results ?? []).length > 0);

    const matrixQ = matrixSearch.trim().toLowerCase();
    const filteredMembersForMatrix = matrixQ
        ? membersWithResults.filter(m => (m?.name ?? '').toLowerCase().includes(matrixQ))
        : membersWithResults;

    const talentCodes = GALLUP_TALENTS.map(t => t.code);
    const membersRankMaps = membersWithResults.map(m => {
        const map: Record<string, number> = {};
        (m?.results ?? []).forEach(r => { if (r?.talent) map[r.talent] = r.rank; });
        return map;
    });

    const teamRanks = teamTalentRanks(membersRankMaps, talentCodes);
    const teamRankMap: Record<string, number> = {};
    teamRanks.forEach(tr => { teamRankMap[tr.talent] = tr.teamRank; });

    const talentsByDomainMap: Record<GallupDomain, string[]> = {
        executing: getTalentsByDomain('executing').map(t => t.code),
        influencing: getTalentsByDomain('influencing').map(t => t.code),
        relationship_building: getTalentsByDomain('relationship_building').map(t => t.code),
        strategic_thinking: getTalentsByDomain('strategic_thinking').map(t => t.code),
    };

    const teamTopN = teamRanks.filter(tr => tr.teamRank <= (showTop15Domains ? 15 : 5));
    const domainCounts: Record<GallupDomain, number> = {
        executing: 0, influencing: 0, relationship_building: 0, strategic_thinking: 0,
    };
    teamTopN.forEach(tr => {
        const talent = GALLUP_TALENTS.find(t => t.code === tr.talent);
        if (talent) domainCounts[talent.domain]++;
    });
    const domainCountData = (Object.entries(domainCounts) as [GallupDomain, number][])
        .filter(([, count]) => count > 0)
        .map(([domain, count]) => ({
            name: locale === 'en' ? DOMAIN_LABELS[domain]?.en : DOMAIN_LABELS[domain]?.pl,
            value: count,
            color: getDomainStyle(domain),
        }));

    const domainScores = membersRankMaps.length > 0
        ? teamDomainScores(membersRankMaps, talentsByDomainMap)
        : [];
    const radarData = domainScores.map(ds => ({
        domain: locale === 'en' ? DOMAIN_LABELS[ds.domain]?.en : DOMAIN_LABELS[ds.domain]?.pl,
        value: Math.max(0, Math.round(ds.score * 10) / 10),
        score: ds.score,
        color: getDomainStyle(ds.domain),
    }));

    const talentTop15Counts: Record<string, number> = {};
    membersWithResults.forEach(m => {
        m.results.filter(r => r.rank <= 15).forEach(r => {
            talentTop15Counts[r.talent] = (talentTop15Counts[r.talent] || 0) + 1;
        });
    });

    const memberNames = membersWithResults.map(m => m.name);
    const weaknesses = membersRankMaps.length >= 2 ? findTeamWeaknesses(membersRankMaps, talentCodes) : [];
    const spofList = membersRankMaps.length >= 2 ? findSPOF(membersRankMaps, talentCodes) : [];
    const resilience = teamResilience(membersRankMaps, talentCodes);
    const contributions = membersRankMaps.length >= 2 ? uniqueContributions(membersRankMaps, talentCodes) : [];
    const pairs = membersRankMaps.length >= 2 ? complementaryPairs(membersRankMaps, talentCodes) : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 flex-wrap">
                <button
                    onClick={() => setActiveTab('matrix')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'matrix'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                >
                    <Grid3x3 className="w-4 h-4" />
                    {t('matrix')}
                </button>
                <button
                    onClick={() => setActiveTab('domains')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'domains'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                >
                    <PieChart className="w-4 h-4" />
                    {t('domains')}
                </button>
                <button
                    onClick={() => setActiveTab('profiles')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'profiles'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                >
                    <BarChart3 className="w-4 h-4" />
                    {t('profilesTab')}
                </button>

                {activeTab === 'matrix' && (
                    <div className="relative ml-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('searchPerson')}
                            value={matrixSearch}
                            onChange={e => setMatrixSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                        />
                    </div>
                )}
            </div>

            {activeTab === 'matrix' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {headerTooltip && (() => {
                        const info = talentInfoByCode.get(headerTooltip.code);
                        const local = GALLUP_TALENTS.find(t => t.code === headerTooltip.code);
                        if (!local) return null;
                        const name = info?.translation?.name ?? (locale === 'en' ? local.en : local.pl);
                        const shortDesc = info?.translation?.short_description;
                        const domainColor = getDomainStyle(local.domain);
                        const domainLabel = locale === 'en' ? DOMAIN_LABELS[local.domain]?.en : DOMAIN_LABELS[local.domain]?.pl;
                        return (
                            <div
                                className="fixed z-50 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg pointer-events-none"
                                style={{ left: headerTooltip.x, top: headerTooltip.y + 8 }}
                            >
                                <div className="font-semibold text-sm text-slate-900">{name}</div>
                                <div className="text-xs font-medium mb-1" style={{ color: domainColor }}>{domainLabel}</div>
                                {shortDesc && <div className="text-xs text-slate-600 leading-relaxed">{shortDesc}</div>}
                            </div>
                        );
                    })()}
                    {membersWithResults.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            {t('noTalentData')}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="bg-slate-50">
                                        <th className="sticky left-0 bg-slate-50 z-10 px-3 py-2 font-semibold text-slate-900 min-w-[160px] border-b border-r border-slate-200">
                                            {t('personColumn')}
                                        </th>
                                        {GALLUP_TALENTS.map(talent => (
                                            // Tailwind v4 px/py are logical (padding-inline/block): under vertical-rl, py sets physical horizontal padding
                                            <th key={talent.code} className="px-3 py-1 border-b border-slate-200 cursor-help" style={{
                                                writingMode: 'vertical-rl',
                                                textOrientation: 'mixed',
                                                transform: 'rotate(180deg)',
                                                color: getDomainStyle(talent.domain),
                                                borderTop: `4px solid ${getDomainStyle(talent.domain)}`,
                                                minWidth: '32px',
                                                whiteSpace: 'nowrap',
                                                lineHeight: '1.1',
                                                fontSize: '11px',
                                            }}
                                            onMouseEnter={e => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                // Clamp so the w-64 (256px) tooltip stays inside the viewport
                                                const x = Math.min(Math.max(rect.left + rect.width / 2, 136), window.innerWidth - 136);
                                                setHeaderTooltip({ code: talent.code, x, y: rect.bottom });
                                            }}
                                            onMouseLeave={() => setHeaderTooltip(null)}>
                                                {locale === 'en' ? talent.en : talent.pl}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMembersForMatrix.map(member => {
                                        const rankMap: Record<string, number> = {};
                                        member.results.forEach(r => { rankMap[r.talent] = r.rank; });
                                        return (
                                            <tr key={member.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                                <td className="sticky left-0 bg-white z-10 px-3 py-2 font-medium text-slate-900 border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">
                                                    {member.name}
                                                </td>
                                                {GALLUP_TALENTS.map(talent => {
                                                    const rank = rankMap[talent.code];
                                                    const isMissing = !rank;

                                                    const bg = isMissing ? 'transparent'
                                                        : rank >= 30 ? '#f1f5f9'
                                                        : getDomainStyle(talent.domain, rank <= 5 ? 100 : rank <= 15 ? 75 : 20);
                                                    const textColor = isMissing ? '#cbd5e1'
                                                        : rank >= 30 ? '#94a3b8'
                                                        : rank <= 15 ? '#fff' : '#0f172a';

                                                    return (
                                                        <td key={talent.code} className="px-0.5 py-1 text-center border-r border-slate-100 last:border-r-0">
                                                            <div className="mx-auto flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold" style={{
                                                                background: bg,
                                                                color: textColor,
                                                                border: isMissing ? '1px dashed #e2e8f0' : 'none',
                                                            }}>
                                                                {isMissing ? '+' : rank}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}

                                    {/* Team Rank Row */}
                                    {teamRanks.length > 0 && (
                                        <tr className="bg-slate-50 border-t-2 border-slate-200">
                                            <td className="sticky left-0 bg-slate-50 z-10 px-3 py-2 font-bold text-slate-900 border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">
                                                {t('teamRanking')}
                                            </td>
                                            {GALLUP_TALENTS.map(talent => {
                                                const rank = teamRankMap[talent.code];
                                                if (!rank) return <td key={talent.code} className="text-center">-</td>;

                                                const bg = rank >= 30
                                                    ? '#f1f5f9'
                                                    : getDomainStyle(talent.domain, rank <= 5 ? 100 : rank <= 15 ? 75 : 20);
                                                const textColor = rank >= 30
                                                    ? '#94a3b8'
                                                    : rank <= 15 ? '#fff' : '#0f172a';

                                                return (
                                                    <td key={talent.code} className="px-0.5 py-1 text-center border-r border-slate-100 last:border-r-0">
                                                        <div className="mx-auto flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold" style={{
                                                            background: bg,
                                                            color: textColor,
                                                        }}>
                                                            {rank}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    )}

                                    {/* Summary Row */}
                                    <tr className="bg-white">
                                        <td className="sticky left-0 bg-white z-10 px-3 py-2 font-semibold text-xs text-slate-500 uppercase tracking-wider border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">
                                            {t('inTop15')}
                                        </td>
                                        {GALLUP_TALENTS.map(talent => {
                                            const count = talentTop15Counts[talent.code] || 0;
                                            return (
                                                <td key={talent.code} className="px-0.5 py-1 text-center border-r border-slate-100 last:border-r-0">
                                                    <div className="mx-auto flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold" style={{
                                                        background: count >= 2 ? getDomainStyle(talent.domain, 80) : count === 1 ? getDomainStyle(talent.domain, 25) : 'transparent',
                                                        color: count >= 2 ? '#fff' : count === 1 ? getDomainStyle(talent.domain) : '#94a3b8',
                                                    }}>
                                                        {count || ''}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'domains' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-[4fr_2fr_4fr] gap-6">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold text-slate-900">
                                    {t('representationIn', { range: showTop15Domains ? 'Top 15' : 'Top 5' })}
                                </h3>
                                <div className="flex bg-slate-100 p-1 rounded-lg">
                                    <button
                                        onClick={() => setShowTop15Domains(false)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${!showTop15Domains ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Top 5
                                    </button>
                                    <button
                                        onClick={() => setShowTop15Domains(true)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${showTop15Domains ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Top 15
                                    </button>
                                </div>
                            </div>

                            {membersWithResults.length > 0 ? (
                                <div className="flex-1 min-h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RePieChart>
                                            <Pie data={domainCountData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                                outerRadius={100} innerRadius={60} paddingAngle={2} strokeWidth={0}>
                                                {domainCountData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }} />
                                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                        </RePieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-slate-500">{t('noData')}</div>
                            )}
                        </div>

                        <TeamRankList teamRanks={teamRanks} topN={showTop15Domains ? 15 : 5} />

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
                            <h3 className="text-lg font-semibold text-slate-900 mb-6">{t('domainPotential')}</h3>
                            {membersWithResults.length > 0 ? (
                                <div className="flex-1 min-h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={85} margin={{ top: 15, right: 35, bottom: 15, left: 35 }}>
                                            <PolarGrid stroke="#e2e8f0" />
                                            <PolarAngleAxis
                                                dataKey="domain"
                                                tick={(props: { payload?: { value: string }, x?: string | number, y?: string | number, textAnchor?: "end" | "inherit" | "middle" | "start" }) => {
                                                    if (!props.payload) return <text></text>;
                                                    const item = radarData.find(d => d.domain === props.payload!.value);
                                                    return (
                                                        <text x={props.x} y={props.y} textAnchor={props.textAnchor} fill={item?.color || '#64748b'} fontSize={12} fontWeight={600} dy={typeof props.y === 'number' && props.y > 150 ? 14 : -6}>
                                                            {props.payload.value}
                                                        </text>
                                                    );
                                                }}
                                            />
                                            <PolarRadiusAxis tick={false} axisLine={false} />
                                            <Radar dataKey="value" stroke="#94a3b8" fill="#cbd5e1" fillOpacity={0.3} strokeWidth={2} />
                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                            <Tooltip content={({ active, payload }: any) => {
                                                if (!active || !payload?.[0]) return null;
                                                const p = payload[0].payload;
                                                return (
                                                    <div className="bg-white border border-slate-200 shadow-md rounded-lg p-3 text-slate-900">
                                                        <div className="font-semibold mb-1">{p.domain}</div>
                                                        <div className="text-slate-600">{p.score} pkt</div>
                                                    </div>
                                                );
                                            }} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-slate-500">{t('noData')}</div>
                            )}
                        </div>
                    </div>

                    <TalentHeatmap counts={talentTop15Counts} />

                    {canSeeRisks && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <TeamRisks
                                weaknesses={weaknesses}
                                spof={spofList}
                                resilience={resilience}
                                memberNames={memberNames}
                                membersWithResultsCount={membersWithResults.length}
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <UniqueContributions contributions={contributions} memberNames={memberNames} />
                        {canSeeRisks && (
                            <ComplementaryPairs
                                pairs={pairs}
                                memberNames={memberNames}
                                membersWithResultsCount={membersWithResults.length}
                            />
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'profiles' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button
                                onClick={() => setShowTop15Profiles(false)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${!showTop15Profiles ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Top 5
                            </button>
                            <button
                                onClick={() => setShowTop15Profiles(true)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${showTop15Profiles ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Top 15
                            </button>
                        </div>
                    </div>
                    {membersWithResults.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-500">
                            {t('noTalentData')}
                        </div>
                    ) : (
                        <MemberProfileCards members={membersWithResults} topN={showTop15Profiles ? 15 : 5} />
                    )}
                </div>
            )}
        </div>
    );
}
