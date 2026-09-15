"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api, TeamPresentationLinkResponse } from '@/lib/api';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
    Copy,
    Check,
    ExternalLink,
    RefreshCw,
    Trash2,
    ShieldAlert,
    Share2,
    Loader2,
    Calendar,
    AlertTriangle,
} from 'lucide-react';

interface PresentationLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamId: number;
    teamName: string;
}

export default function PresentationLinkModal({
    isOpen,
    onClose,
    teamId,
    teamName,
}: PresentationLinkModalProps) {
    const t = useTranslations('teams');
    const tCommon = useTranslations('common');

    const [linkData, setLinkData] = useState<TeamPresentationLinkResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Toggle anonymized & show_risks for creating new link when empty
    const [emptyAnonymized, setEmptyAnonymized] = useState(false);
    const [emptyShowRisks, setEmptyShowRisks] = useState(false);

    // Confirmation dialogs
    const [confirmRotate, setConfirmRotate] = useState(false);
    const [confirmRevoke, setConfirmRevoke] = useState(false);

    const loadLink = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.teams.getPresentationLink(teamId);
            setLinkData(data);
            if (data.anonymized !== null && data.anonymized !== undefined) {
                setEmptyAnonymized(data.anonymized);
            }
            if (data.show_risks !== null && data.show_risks !== undefined) {
                setEmptyShowRisks(data.show_risks);
            }
        } catch (err) {
            console.error("Failed to load presentation link", err);
            setError(t('loadPresentationError'));
        } finally {
            setLoading(false);
        }
    }, [teamId, t]);

    useEffect(() => {
        if (isOpen) {
            loadLink();
            setConfirmRotate(false);
            setConfirmRevoke(false);
            setCopied(false);
        }
    }, [isOpen, loadLink]);

    const getFullUrl = (token: string) => {
        if (typeof window === 'undefined') return `/presentation/${token}`;
        return `${window.location.origin}/presentation/${token}`;
    };

    const handleCopy = async () => {
        if (!linkData?.token) return;
        try {
            await navigator.clipboard.writeText(getFullUrl(linkData.token));
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch (err) {
            console.error("Failed to copy link", err);
        }
    };

    const handleCreateLink = async () => {
        try {
            setActionLoading(true);
            setError(null);
            const res = await api.teams.createPresentationLink(teamId, {
                anonymized: emptyAnonymized,
                show_risks: emptyShowRisks,
            });
            setLinkData(res);
        } catch (err) {
            console.error("Failed to create presentation link", err);
            setError(t('createPresentationError'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleAnonymized = async (checked: boolean) => {
        if (!linkData?.token) return;
        try {
            setActionLoading(true);
            setError(null);
            const res = await api.teams.updatePresentationLink(teamId, { anonymized: checked });
            setLinkData(res);
        } catch (err) {
            console.error("Failed to update anonymization", err);
            setError(t('updatePresentationError'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleShowRisks = async (checked: boolean) => {
        if (!linkData?.token) return;
        try {
            setActionLoading(true);
            setError(null);
            const res = await api.teams.updatePresentationLink(teamId, { show_risks: checked });
            setLinkData(res);
        } catch (err) {
            console.error("Failed to update risk analysis visibility", err);
            setError(t('updatePresentationError'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleRotateLink = async () => {
        try {
            setActionLoading(true);
            setError(null);
            const currentAnonymized = linkData?.anonymized ?? false;
            const currentShowRisks = linkData?.show_risks ?? false;
            const res = await api.teams.createPresentationLink(teamId, {
                anonymized: currentAnonymized,
                show_risks: currentShowRisks,
            });
            setLinkData(res);
            setConfirmRotate(false);
            setCopied(false);
        } catch (err) {
            console.error("Failed to rotate presentation link", err);
            setError(t('rotatePresentationError'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleRevokeLink = async () => {
        try {
            setActionLoading(true);
            setError(null);
            await api.teams.deletePresentationLink(teamId);
            setLinkData({
                token: null,
                url: null,
                anonymized: null,
                show_risks: null,
                created_at: null,
            });
            setConfirmRevoke(false);
        } catch (err) {
            console.error("Failed to revoke presentation link", err);
            setError(t('revokePresentationError'));
        } finally {
            setActionLoading(false);
        }
    };

    const hasActiveToken = !!linkData?.token;
    const shareableUrl = linkData?.token ? getFullUrl(linkData.token) : '';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                <DialogHeader className="space-y-1 text-left">
                    <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Share2 className="h-5 w-5" />
                        </div>
                        <DialogTitle className="text-xl font-bold text-slate-900">
                            {t('presentationLinkModalTitle')}
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-sm text-slate-500">
                        {t('presentationLinkModalDesc', { team: teamName })}
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-12 text-slate-400">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : hasActiveToken ? (
                    <div className="space-y-5">
                        {/* URL input + Copy */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                {t('presentationUrlLabel')}
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={shareableUrl}
                                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none select-all"
                                />
                                <Button
                                    type="button"
                                    onClick={handleCopy}
                                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 transition-all ${
                                        copied
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-primary text-white hover:bg-primary/90'
                                    }`}
                                >
                                    {copied ? (
                                        <>
                                            <Check className="h-4 w-4" />
                                            <span>{t('linkCopied')}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-4 w-4" />
                                            <span>{t('copyLink')}</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Open preview button */}
                        <div className="flex items-center justify-between">
                            <Button
                                variant="outline"
                                type="button"
                                onClick={() => window.open(shareableUrl, '_blank')}
                                className="inline-flex items-center gap-2 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs py-1.5 px-3"
                            >
                                <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                                {t('openPreview')}
                            </Button>

                            {linkData?.created_at && (
                                <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>
                                        {t('createdDate')}:{' '}
                                        {new Date(linkData.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Toggle Anonymization (PATCH) */}
                        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                            <div className="space-y-0.5 pr-4">
                                <label
                                    htmlFor="anonymize-toggle"
                                    className="text-sm font-medium text-slate-800 cursor-pointer"
                                >
                                    {t('anonymizeToggleTitle')}
                                </label>
                                <p className="text-xs text-slate-500">
                                    {t('anonymizeToggleDesc')}
                                </p>
                            </div>
                            <Switch
                                id="anonymize-toggle"
                                checked={linkData?.anonymized ?? false}
                                onCheckedChange={handleToggleAnonymized}
                                disabled={actionLoading}
                            />
                        </div>

                        {/* Toggle Risk Analysis (PATCH) */}
                        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                            <div className="space-y-0.5 pr-4">
                                <label
                                    htmlFor="show-risks-toggle"
                                    className="text-sm font-medium text-slate-800 cursor-pointer"
                                >
                                    {t('showRisksToggleTitle')}
                                </label>
                                <p className="text-xs text-slate-500">
                                    {t('showRisksToggleDesc')}
                                </p>
                            </div>
                            <Switch
                                id="show-risks-toggle"
                                checked={linkData?.show_risks ?? false}
                                onCheckedChange={handleToggleShowRisks}
                                disabled={actionLoading}
                            />
                        </div>

                        {/* Public Access Warning */}
                        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-800">
                            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                            <p>{t('publicLinkSecurityWarning')}</p>
                        </div>

                        {/* Rotate & Revoke Actions */}
                        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                            {confirmRotate ? (
                                <div className="flex items-center gap-2 w-full justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                    <span className="text-xs text-slate-600 font-medium">
                                        {t('confirmRotateQuestion')}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setConfirmRotate(false)}
                                            className="h-7 text-xs"
                                        >
                                            {tCommon('cancel')}
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleRotateLink}
                                            disabled={actionLoading}
                                            className="h-7 text-xs bg-primary text-white"
                                        >
                                            {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : t('confirmRotateAction')}
                                        </Button>
                                    </div>
                                </div>
                            ) : confirmRevoke ? (
                                <div className="flex items-center gap-2 w-full justify-between bg-red-50 p-2.5 rounded-xl border border-red-200">
                                    <span className="text-xs text-red-700 font-medium">
                                        {t('confirmRevokeQuestion')}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setConfirmRevoke(false)}
                                            className="h-7 text-xs text-slate-600"
                                        >
                                            {tCommon('cancel')}
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleRevokeLink}
                                            disabled={actionLoading}
                                            className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white"
                                        >
                                            {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : t('confirmRevokeAction')}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setConfirmRotate(true)}
                                        disabled={actionLoading}
                                        className="inline-flex items-center gap-1.5 rounded-xl text-xs text-slate-700 border-slate-200 hover:bg-slate-50"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                                        {t('rotateLinkButton')}
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setConfirmRevoke(true)}
                                        disabled={actionLoading}
                                        className="inline-flex items-center gap-1.5 rounded-xl text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                        {t('revokeLinkButton')}
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Empty State - No active link */
                    <div className="space-y-6 py-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center space-y-2">
                            <p className="text-sm text-slate-600">
                                {t('emptyLinkExplainer')}
                            </p>
                        </div>

                        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="space-y-0.5 pr-4">
                                <label
                                    htmlFor="empty-anonymize-toggle"
                                    className="text-sm font-medium text-slate-800 cursor-pointer"
                                >
                                    {t('anonymizeToggleTitle')}
                                </label>
                                <p className="text-xs text-slate-500">
                                    {t('anonymizeToggleDesc')}
                                </p>
                            </div>
                            <Switch
                                id="empty-anonymize-toggle"
                                checked={emptyAnonymized}
                                onCheckedChange={setEmptyAnonymized}
                                disabled={actionLoading}
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="space-y-0.5 pr-4">
                                <label
                                    htmlFor="empty-show-risks-toggle"
                                    className="text-sm font-medium text-slate-800 cursor-pointer"
                                >
                                    {t('showRisksToggleTitle')}
                                </label>
                                <p className="text-xs text-slate-500">
                                    {t('showRisksToggleDesc')}
                                </p>
                            </div>
                            <Switch
                                id="empty-show-risks-toggle"
                                checked={emptyShowRisks}
                                onCheckedChange={setEmptyShowRisks}
                                disabled={actionLoading}
                            />
                        </div>

                        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-800">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                            <p>{t('emptyLinkSecurityNote')}</p>
                        </div>

                        <Button
                            type="button"
                            onClick={handleCreateLink}
                            disabled={actionLoading}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white py-3 shadow-sm hover:bg-primary/90"
                        >
                            {actionLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Share2 className="h-4 w-4" />
                            )}
                            {t('generateLinkButton')}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
