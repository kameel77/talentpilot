"use client";

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, PublicPresentationResponse } from '@/lib/api';
import { getLocaleFromCookie } from '@/lib/locale';
import MatrixDashboard from '@/components/dashboard/MatrixDashboard';
import { CoachSignatureInline } from '@/components/public/CoachSignature';
import { Users, Building2, AlertCircle, ShieldAlert, Sparkles } from 'lucide-react';

interface PublicPresentationProps {
    token: string;
}

export default function PublicPresentation({ token }: PublicPresentationProps) {
    const t = useTranslations('teams');
    const tCommon = useTranslations('common');
    const [data, setData] = useState<PublicPresentationResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorStatus, setErrorStatus] = useState<number | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchPresentation = async () => {
            try {
                setLoading(true);
                setErrorStatus(null);
                const locale = getLocaleFromCookie() || 'pl';
                const res = await api.public.getPresentation(token, locale);
                if (isMounted) {
                    setData(res);
                }
            } catch (err: unknown) {
                if (isMounted) {
                    const status = (err as { response?: { status?: number } })?.response?.status;
                    setErrorStatus(status || 500);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchPresentation();
        return () => {
            isMounted = false;
        };
    }, [token]);

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="h-8 w-64 rounded bg-slate-200 mb-3" />
                        <div className="h-4 w-40 rounded bg-slate-100" />
                    </div>
                    <div className="h-96 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" />
                </div>
            </main>
        );
    }

    if (errorStatus === 404) {
        return (
            <main className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4">
                <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 mb-4">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">
                        {t('presentationNotFoundTitle')}
                    </h1>
                    <p className="text-sm text-slate-600">
                        {t('presentationNotFoundDesc')}
                    </p>
                </div>
            </main>
        );
    }

    if (errorStatus === 429) {
        return (
            <main className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4">
                <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-4">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">
                        {t('rateLimitExceededTitle')}
                    </h1>
                    <p className="text-sm text-slate-600">
                        {t('rateLimitExceededDesc')}
                    </p>
                </div>
            </main>
        );
    }

    if (!data) {
        return (
            <main className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4">
                <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-4">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">
                        {tCommon('errorGeneric')}
                    </h1>
                    <p className="text-sm text-slate-600">
                        {tCommon('errorOccurred')}
                    </p>
                </div>
            </main>
        );
    }

    // Map public presentation members to MatrixDashboard expectations
    // Note: role is omitted to avoid hardcoded non-i18n strings
    const mappedMembers = data.members.map((m, mIdx) => ({
        id: mIdx + 1,
        name: m.display_name,
        is_leader: m.is_leader,
        results: m.results.map((r) => ({
            id: `${mIdx}-${r.talent}`,
            rank: r.rank,
            talent: r.talent,
            domain: r.domain,
        })),
    }));

    return (
        <main className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl space-y-6">
                {/* Header card with team context & branding */}
                <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary mb-2">
                            <Sparkles className="h-3 w-3" />
                            {t('presentationBadge')}
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                            {data.team_name}
                        </h1>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                            {data.organization_name && (
                                <span className="inline-flex items-center gap-1.5">
                                    <Building2 className="h-4 w-4 text-slate-400" />
                                    {data.organization_name}
                                </span>
                            )}
                            <span className="inline-flex items-center gap-1.5">
                                <Users className="h-4 w-4 text-slate-400" />
                                {data.members.length} {t('members')}
                            </span>
                        </div>
                    </div>
                    <div className="self-start sm:self-auto sm:text-right space-y-1">
                        {data.prepared_by && (
                            <CoachSignatureInline
                                signature={data.prepared_by}
                                lang={getLocaleFromCookie() === 'en' ? 'en' : 'pl'}
                            />
                        )}
                        <div className="text-xs text-slate-400 font-medium">TalentPilot</div>
                    </div>
                </header>

                {/* Matrix Dashboard with manager-controlled risks visibility */}
                <MatrixDashboard
                    members={mappedMembers}
                    talents={data.talents}
                    canSeeRisks={Boolean(data.show_risks)}
                />
            </div>
        </main>
    );
}
