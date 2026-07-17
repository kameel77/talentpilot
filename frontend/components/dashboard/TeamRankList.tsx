"use client";

import { useTranslations } from 'next-intl';
import { getLocaleFromCookie } from '@/lib/locale';
import { GALLUP_TALENTS, getDomainStyle } from '@/lib/gallup-data';
import type { TeamTalentRankResult } from '@/lib/team-algorithms';

interface TeamRankListProps {
    teamRanks: TeamTalentRankResult[];
    topN: number;
}

export default function TeamRankList({ teamRanks, topN }: TeamRankListProps) {
    const t = useTranslations('teams');
    const locale = getLocaleFromCookie();

    const topRanks = teamRanks.filter(tr => tr.teamRank <= topN);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">{t('teamRankList')}</h3>
            <div className="flex flex-col gap-1.5">
                {topRanks.map(tr => {
                    const talent = GALLUP_TALENTS.find(gt => gt.code === tr.talent);
                    if (!talent) return null;
                    return (
                        <div
                            key={tr.talent}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide"
                            style={{
                                background: getDomainStyle(talent.domain, 15),
                                color: getDomainStyle(talent.domain),
                            }}
                        >
                            #{tr.teamRank} {locale === 'en' ? talent.en : talent.pl}
                        </div>
                    );
                })}
                {topRanks.length === 0 && (
                    <p className="text-sm text-slate-500">{t('noData')}</p>
                )}
            </div>
        </div>
    );
}
