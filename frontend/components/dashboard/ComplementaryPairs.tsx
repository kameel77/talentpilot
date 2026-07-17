"use client";

import { useTranslations } from 'next-intl';
import { getLocaleFromCookie } from '@/lib/locale';
import { GALLUP_TALENTS, getDomainStyle } from '@/lib/gallup-data';
import type { ComplementaryPairResult, PairCoverage } from '@/lib/team-algorithms';
import { Handshake } from 'lucide-react';

interface ComplementaryPairsProps {
    pairs: ComplementaryPairResult[];
    memberNames: string[];   // index-aligned with membersRankMaps
    membersWithResultsCount: number;
}

function CoverageRow({ coverage, locale, label }: { coverage: PairCoverage[]; locale: string; label: string }) {
    if (coverage.length === 0) return null;
    return (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-600">{label}</span>
            {coverage.map(cov => {
                const talent = GALLUP_TALENTS.find(gt => gt.code === cov.talentCode);
                if (!talent) return null;
                return (
                    <span
                        key={cov.talentCode}
                        className="px-2 py-0.5 rounded font-semibold"
                        style={{
                            background: getDomainStyle(talent.domain, 15),
                            color: getDomainStyle(talent.domain),
                        }}
                        title={`#${cov.coveringRank} vs #${cov.coveredRank}`}
                    >
                        {locale === 'en' ? talent.en : talent.pl}
                    </span>
                );
            })}
        </div>
    );
}

export default function ComplementaryPairs({ pairs, memberNames, membersWithResultsCount }: ComplementaryPairsProps) {
    const t = useTranslations('teams');
    const locale = getLocaleFromCookie();

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2">
                <Handshake className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-semibold text-slate-900">{t('complementaryPairs')}</h3>
            </div>
            <p className="text-sm text-slate-500 mt-1 mb-4">{t('complementaryPairsDesc')}</p>
            {membersWithResultsCount < 2 ? (
                <p className="text-sm text-slate-500">{t('needTwoMembers')}</p>
            ) : pairs.length > 0 ? (
                <div className="space-y-4">
                    {pairs.slice(0, 5).map(pair => (
                        <div key={`${pair.memberA}-${pair.memberB}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-1.5">
                            <div className="text-sm font-semibold text-slate-900">
                                {memberNames[pair.memberA]} ↔ {memberNames[pair.memberB]}
                            </div>
                            <CoverageRow
                                coverage={pair.aCoversB}
                                locale={locale}
                                label={t('pairCovers', { name: memberNames[pair.memberA] }) + ':'}
                            />
                            <CoverageRow
                                coverage={pair.bCoversA}
                                locale={locale}
                                label={t('pairCovers', { name: memberNames[pair.memberB] }) + ':'}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-slate-500">{t('noPairs')}</p>
            )}
        </div>
    );
}
