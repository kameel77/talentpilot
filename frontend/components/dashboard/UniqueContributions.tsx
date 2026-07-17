"use client";

import { useTranslations } from 'next-intl';
import { getLocaleFromCookie } from '@/lib/locale';
import { GALLUP_TALENTS, getDomainStyle } from '@/lib/gallup-data';
import type { UniqueContributionResult } from '@/lib/team-algorithms';
import { Sparkles } from 'lucide-react';

interface UniqueContributionsProps {
    contributions: UniqueContributionResult[];
    memberNames: string[];   // index-aligned with membersRankMaps
}

export default function UniqueContributions({ contributions, memberNames }: UniqueContributionsProps) {
    const t = useTranslations('teams');
    const locale = getLocaleFromCookie();

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-semibold text-slate-900">{t('uniqueContributions')}</h3>
            </div>
            <p className="text-sm text-slate-500 mt-1 mb-4">{t('uniqueContributionsDesc')}</p>
            <div className="space-y-3">
                {contributions.map(c => (
                    <div key={c.memberIndex} className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 w-40 shrink-0">
                            {memberNames[c.memberIndex]}
                        </span>
                        {c.talents.length > 0 ? (
                            c.talents.map(({ talentCode, rank }) => {
                                const talent = GALLUP_TALENTS.find(gt => gt.code === talentCode);
                                if (!talent) return null;
                                return (
                                    <span
                                        key={talentCode}
                                        className="px-2.5 py-1 rounded-md text-xs font-semibold"
                                        style={{
                                            background: getDomainStyle(talent.domain, 15),
                                            color: getDomainStyle(talent.domain),
                                        }}
                                    >
                                        #{rank} {locale === 'en' ? talent.en : talent.pl}
                                    </span>
                                );
                            })
                        ) : (
                            <span className="text-xs text-slate-400 italic">{t('noUniqueContributions')}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
