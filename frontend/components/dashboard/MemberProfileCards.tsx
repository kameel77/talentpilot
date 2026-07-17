"use client";

import { useTranslations } from 'next-intl';
import { getLocaleFromCookie } from '@/lib/locale';
import { GALLUP_TALENTS, getDomainStyle, DOMAIN_LABELS, GallupDomain } from '@/lib/gallup-data';
import { checkDomainSpecialist } from '@/lib/team-algorithms';
import { Star } from 'lucide-react';

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

interface MemberProfileCardsProps {
    members: Member[];   // only members with results
    topN: number;        // 5 or 15
}

export default function MemberProfileCards({ members, topN }: MemberProfileCardsProps) {
    const t = useTranslations('teams');
    const locale = getLocaleFromCookie();
    const talentCodes = GALLUP_TALENTS.map(gt => gt.code);
    const talentDomainMap: Record<string, GallupDomain> = {};
    GALLUP_TALENTS.forEach(gt => { talentDomainMap[gt.code] = gt.domain; });

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {members.map(member => {
                const topTalents = member.results
                    .filter(r => r.rank <= topN)
                    .sort((a, b) => a.rank - b.rank);

                const domainProfile: Record<GallupDomain, number> = {
                    executing: 0, influencing: 0, relationship_building: 0, strategic_thinking: 0,
                };
                topTalents.forEach(r => {
                    const d = r.domain as GallupDomain;
                    if (domainProfile[d] !== undefined) domainProfile[d]++;
                });
                const topDomain = (Object.entries(domainProfile) as [GallupDomain, number][])
                    .sort((a, b) => b[1] - a[1])[0];

                const rankMap: Record<string, number> = {};
                member.results.forEach(r => { rankMap[r.talent] = r.rank; });
                const specialist = checkDomainSpecialist(rankMap, talentCodes, talentDomainMap);

                return (
                    <div key={member.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">{member.name}</h3>
                                {member.role && <p className="text-xs text-slate-500">{member.role}</p>}
                            </div>
                            <div className="relative inline-flex">
                                <span
                                    className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
                                    style={{
                                        background: getDomainStyle(topDomain[0], 15),
                                        color: getDomainStyle(topDomain[0]),
                                    }}
                                >
                                    {locale === 'en' ? DOMAIN_LABELS[topDomain[0]]?.en : DOMAIN_LABELS[topDomain[0]]?.pl}
                                </span>
                                {specialist.isSpecialist && (
                                    <span
                                        className="absolute -top-2 -right-2 cursor-help"
                                        title={t('specialistTooltip')}
                                        style={{ color: getDomainStyle(topDomain[0]) }}
                                    >
                                        <Star className="w-3.5 h-3.5" fill="currentColor" />
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {topTalents.map(r => {
                                const talent = GALLUP_TALENTS.find(gt => gt.code === r.talent);
                                if (!talent) return null;
                                return (
                                    <span
                                        key={r.talent}
                                        className="px-2.5 py-1 rounded-md text-xs font-semibold border"
                                        style={{
                                            background: getDomainStyle(talent.domain, 15),
                                            color: getDomainStyle(talent.domain),
                                            borderColor: getDomainStyle(talent.domain, 25),
                                        }}
                                    >
                                        #{r.rank} {locale === 'en' ? talent.en : talent.pl}
                                    </span>
                                );
                            })}
                        </div>

                        <div className="flex gap-1">
                            {(Object.entries(domainProfile) as [GallupDomain, number][]).map(([d, count]) => (
                                <div
                                    key={d}
                                    className="h-1.5 rounded-full transition-all"
                                    style={{
                                        flex: count || 0.2,
                                        background: count ? getDomainStyle(d) : getDomainStyle(d, 15),
                                    }}
                                    title={`${locale === 'en' ? DOMAIN_LABELS[d]?.en : DOMAIN_LABELS[d]?.pl}: ${count}`}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
