"use client";

import { useTranslations } from 'next-intl';
import { getLocaleFromCookie } from '@/lib/locale';
import { GALLUP_TALENTS, getDomainStyle } from '@/lib/gallup-data';
import type { TeamWeaknessResult, SPOFResult, TeamResilienceResult } from '@/lib/team-algorithms';
import { TrendingDown, ShieldAlert, AlertTriangle, ShieldCheck } from 'lucide-react';

interface TeamRisksProps {
    weaknesses: TeamWeaknessResult[];
    spof: SPOFResult[];
    resilience: TeamResilienceResult;
    memberNames: string[];               // index-aligned with membersRankMaps
    membersWithResultsCount: number;
}

export default function TeamRisks({ weaknesses, spof, resilience, memberNames, membersWithResultsCount }: TeamRisksProps) {
    const t = useTranslations('teams');
    const locale = getLocaleFromCookie();

    if (membersWithResultsCount < 2) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:col-span-2">
                <p className="text-sm text-slate-500">{t('needTwoMembers')}</p>
            </div>
        );
    }

    return (
        <>
            {/* Team Weaknesses */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-rose-500" />
                    <h3 className="text-lg font-semibold text-slate-900">{t('teamWeaknesses')}</h3>
                </div>
                <p className="text-sm text-slate-500 mt-1 mb-4">{t('teamWeaknessesDesc')}</p>
                {weaknesses.length > 0 ? (
                    <div className="space-y-3">
                        {weaknesses.slice(0, 10).map(w => {
                            const talent = GALLUP_TALENTS.find(gt => gt.code === w.talentCode);
                            if (!talent) return null;
                            return (
                                <div key={w.talentCode} className="flex items-center gap-3">
                                    <div className="w-36 shrink-0 text-sm font-semibold" style={{ color: getDomainStyle(talent.domain) }}>
                                        {locale === 'en' ? talent.en : talent.pl}
                                    </div>
                                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-600"
                                            style={{ width: `${w.percentage}%` }}
                                        />
                                    </div>
                                    <div className="w-20 shrink-0 text-right text-xs text-slate-500">
                                        {w.percentage}% {t('ofTeam')}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500">✅ {t('noWeaknesses')}</p>
                )}
            </div>

            {/* SPOF + Resilience KPI */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-amber-500" />
                        <h3 className="text-lg font-semibold text-slate-900">{t('spofAlerts')}</h3>
                    </div>
                    <div
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-sm font-semibold text-slate-700"
                        title={t('resilienceDesc')}
                    >
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        {t('resilience')}: {resilience.percentage}%
                    </div>
                </div>
                <p className="text-sm text-slate-500 mt-1 mb-4">{t('spofAlertsDesc')}</p>
                {spof.length > 0 ? (
                    <div className="space-y-2">
                        {spof.slice(0, 10).map(item => {
                            const talent = GALLUP_TALENTS.find(gt => gt.code === item.talentCode);
                            const carrier = memberNames[item.memberIndex];
                            if (!talent || carrier === undefined) return null;
                            return (
                                <div
                                    key={item.talentCode}
                                    className="flex items-center gap-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100"
                                >
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                    <div>
                                        <div className="text-sm font-semibold" style={{ color: getDomainStyle(talent.domain) }}>
                                            {locale === 'en' ? talent.en : talent.pl}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {t('soleCarrier')}: {carrier} (#{item.memberRank})
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500">✅ {t('noSpof')}</p>
                )}
            </div>
        </>
    );
}
