"use client";

import { useTranslations } from 'next-intl';
import { getLocaleFromCookie } from '@/lib/locale';
import { GALLUP_TALENTS, getDomainStyle } from '@/lib/gallup-data';

interface TalentHeatmapProps {
    counts: Record<string, number>;  // talentCode -> members with it in Top 15
}

export default function TalentHeatmap({ counts }: TalentHeatmapProps) {
    const t = useTranslations('teams');
    const locale = getLocaleFromCookie();

    const entries = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900">{t('talentHeatmap')}</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">{t('talentHeatmapDesc')}</p>
            <div className="flex flex-wrap gap-2">
                {entries.map(([code, count]) => {
                    const talent = GALLUP_TALENTS.find(gt => gt.code === code);
                    if (!talent) return null;
                    return (
                        <span
                            key={code}
                            className="px-3.5 py-1.5 rounded-lg text-sm font-semibold uppercase tracking-wide"
                            style={{
                                background: getDomainStyle(talent.domain, 15),
                                color: getDomainStyle(talent.domain),
                            }}
                        >
                            {locale === 'en' ? talent.en : talent.pl} ({count})
                        </span>
                    );
                })}
                {entries.length === 0 && (
                    <p className="text-sm text-slate-500">{t('noData')}</p>
                )}
            </div>
        </div>
    );
}
