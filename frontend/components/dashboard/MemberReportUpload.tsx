"use client";

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getLocaleFromCookie } from '@/lib/locale';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Check, X } from 'lucide-react';

interface MemberReportUploadProps {
    userId: number;
    memberName: string;
    onDone: () => void | Promise<void>;
}

type UploadState =
    | { phase: 'idle' }
    | { phase: 'processing' }
    | { phase: 'success'; count: number }
    | { phase: 'error'; message: string };

export default function MemberReportUpload({ userId, memberName, onDone }: MemberReportUploadProps) {
    const t = useTranslations('teams');
    const tCommon = useTranslations('common');
    const locale = getLocaleFromCookie();
    const inputRef = useRef<HTMLInputElement>(null);
    const [state, setState] = useState<UploadState>({ phase: 'idle' });
    const dialogOpen = state.phase !== 'idle';

    const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setState({ phase: 'processing' });
        try {
            const parsed = await api.gallup.parsePdf(file, locale);
            const rankings: Record<string, number> = parsed.rankings || {};
            if (Object.keys(rankings).length === 0) {
                setState({ phase: 'error', message: t('uploadReportError') });
                return;
            }
            const saved = await api.gallup.saveTalents(userId, rankings, locale);
            setState({ phase: 'success', count: Array.isArray(saved) ? saved.length : Object.keys(rankings).length });
            await onDone();
        } catch (err: unknown) {
            const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
            setState({ phase: 'error', message: typeof detail === 'string' ? detail : t('uploadReportError') });
        }
    };

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={onFileSelect}
            />
            <button
                onClick={() => inputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title={t('uploadReport')}
            >
                <Upload className="w-4 h-4" />
            </button>

            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && state.phase !== 'processing') setState({ phase: 'idle' }); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{t('uploadReportTitle')}</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center gap-3 py-2">
                        {state.phase === 'processing' && (
                            <>
                                <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />
                                <p className="text-sm text-slate-600">{t('uploadReportProcessing')}</p>
                            </>
                        )}
                        {state.phase === 'success' && (
                            <>
                                <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                                <p className="text-sm text-slate-700">
                                    {t('uploadReportSuccess', { count: state.count, name: memberName })}
                                </p>
                            </>
                        )}
                        {state.phase === 'error' && (
                            <>
                                <X className="w-5 h-5 text-rose-500 shrink-0" />
                                <p className="text-sm text-rose-700">{state.message}</p>
                            </>
                        )}
                    </div>
                    {state.phase !== 'processing' && (
                        <div className="flex justify-end">
                            <Button onClick={() => setState({ phase: 'idle' })}>{tCommon('close')}</Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
