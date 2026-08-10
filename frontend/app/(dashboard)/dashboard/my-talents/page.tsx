"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { TalentImportDialog } from '@/components/talent-import/TalentImportDialog';
import { DOMAIN_LABELS, DOMAIN_CSS_KEY, GALLUP_TALENTS, GallupDomain } from '@/lib/gallup-data';
import { getLocaleFromCookie } from '@/lib/locale';
import { UserTalent } from '@/types/talent';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, tokenManager, User, UserDetailResponse } from '@/lib/api';
import {
    Upload,
    Sparkles,
    Star,
    ThumbsUp,
    Ban,
    MessageCircle,
    Lightbulb,
    Edit3,
    Trophy,
    Target,
    Zap,
    ChevronRight,
    Loader2,
    Check,
    X,
    Pencil,
    Smile,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface ManualFields {
    superpowers: string;
    motivators: string;
    blockers: string;
    feedback_style: string;
}

interface TalentListViewProps {
    talents: UserTalent[];
    viewMode: 'top5' | 'top15' | 'all' | 'bottom5';
    locale: string;
}

function TalentListView({ talents, viewMode, locale }: TalentListViewProps) {
    const limit = viewMode === 'top5' ? 5 : viewMode === 'top15' ? 15 : 34;
    let displayTalents = talents;

    if (viewMode === 'bottom5') {
        displayTalents = talents.filter(t => t.rank >= 30 && t.rank <= 34).sort((a, b) => a.rank - b.rank);
    } else {
        displayTalents = talents.filter(t => t.rank <= limit).sort((a, b) => a.rank - b.rank);
    }

    const groupedTalents = displayTalents.reduce((acc, userTalent) => {
        const talent = GALLUP_TALENTS.find(t => t.code === userTalent.talentId);
        if (talent) {
            if (!acc[talent.domain]) acc[talent.domain] = [];
            acc[talent.domain].push({ ...userTalent, talent });
        }
        return acc;
    }, {} as Record<GallupDomain, Array<UserTalent & { talent: typeof GALLUP_TALENTS[0] }>>);

    const domains: GallupDomain[] = ['executing', 'influencing', 'relationship_building', 'strategic_thinking'];

    return (
        <div className="space-y-4">
            {domains.map(domain => {
                const domainTalents = groupedTalents[domain];
                if (!domainTalents || domainTalents.length === 0) return null;

                return (
                    <div key={domain}>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            {locale === 'en' ? DOMAIN_LABELS[domain].en : DOMAIN_LABELS[domain].pl}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {domainTalents.map(({ talent, rank }) => (
                                <div
                                    key={talent.code}
                                    className={cn(
                                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                                        `domain-${DOMAIN_CSS_KEY[domain]}`
                                    )}
                                >
                                    <span
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                                        style={{ backgroundColor: `var(--color-domain-${DOMAIN_CSS_KEY[domain]})` }}
                                    >
                                        {rank}
                                    </span>
                                    {locale === 'en' ? talent.en : talent.pl}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function DomainSummary({ talents, locale, talentsCountLabel }: { talents: UserTalent[]; locale: string; talentsCountLabel: (count: number) => string }) {
    const top15 = talents.filter(t => t.rank <= 15);

    const domainCounts = top15.reduce((acc, userTalent) => {
        const talent = GALLUP_TALENTS.find(t => t.code === userTalent.talentId);
        if (talent) {
            acc[talent.domain] = (acc[talent.domain] || 0) + 1;
        }
        return acc;
    }, {} as Record<GallupDomain, number>);

    const domains: GallupDomain[] = ['executing', 'influencing', 'relationship_building', 'strategic_thinking'];
    const maxCount = Math.max(...Object.values(domainCounts), 1);

    return (
        <div className="space-y-3">
            {domains.map(domain => {
                const count = domainCounts[domain] || 0;
                const percentage = (count / maxCount) * 100;

                return (
                    <div key={domain} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                                {locale === 'en' ? DOMAIN_LABELS[domain].en : DOMAIN_LABELS[domain].pl}
                            </span>
                            <span className="text-muted-foreground">{talentsCountLabel(count)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className={cn("h-full rounded-full transition-all", `bg-domain-${DOMAIN_CSS_KEY[domain]}`)}
                                style={{
                                    width: `${percentage}%`,
                                    backgroundColor: `var(--color-domain-${DOMAIN_CSS_KEY[domain]})`
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function EmptyTalentsView({ onImport }: { onImport: () => void }) {
    const t = useTranslations('myTalents');

    return (
        <Card className="p-8 text-center border-slate-200/60 shadow-sm">
            <div className="max-w-md mx-auto space-y-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold">{t('noTalentsTitle')}</h2>
                    <p className="text-muted-foreground">{t('noTalentsDesc')}</p>
                </div>
                <div className="space-y-3">
                    <Button size="lg" onClick={onImport} className="bg-gradient-primary hover:opacity-90 transition-opacity">
                        <Upload className="h-5 w-5 mr-2" />
                        {t('importTalents')}
                    </Button>
                </div>

                <div className="pt-6 border-t border-slate-200/60 space-y-3 text-left">
                    <div className="grid gap-3">
                        <div className="flex items-start gap-3 text-sm">
                            <div className="rounded-lg p-1.5 domain-executing">
                                <Star className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="font-medium">{t('superpowersTitle')}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 text-sm">
                            <div className="rounded-lg p-1.5 domain-influencing">
                                <Lightbulb className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="font-medium">{t('quickTips')}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 text-sm">
                            <div className="rounded-lg p-1.5 domain-relationship">
                                <MessageCircle className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="font-medium">{t('userManual')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}

// Section for one manual field (view + inline edit)
function ManualSection({
    icon,
    title,
    colorClass,
    iconColorClass,
    value,
    placeholder,
    emptyText,
    editing,
    editValue,
    onEditChange,
}: {
    icon: React.ReactNode;
    title: string;
    colorClass: string;
    iconColorClass: string;
    value?: string;
    placeholder: string;
    emptyText: string;
    editing: boolean;
    editValue: string;
    onEditChange: (v: string) => void;
}) {
    return (
        <Card className={cn("p-6 border-slate-200/60 shadow-sm", colorClass)}>
            <div className="flex items-center gap-3 mb-3">
                <div className={cn("rounded-xl p-2.5", iconColorClass)}>
                    {icon}
                </div>
                <h2 className="text-title">{title}</h2>
            </div>
            {editing ? (
                <textarea
                    className="w-full min-h-[100px] rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none resize-y"
                    placeholder={placeholder}
                    value={editValue}
                    onChange={e => onEditChange(e.target.value)}
                />
            ) : (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {value || <span className="italic text-slate-400">{emptyText}</span>}
                </p>
            )}
        </Card>
    );
}

export default function MyTalentsPage() {
    const t = useTranslations('myTalents');
    const locale = getLocaleFromCookie();
    const router = useRouter();

    useEffect(() => {
        if (tokenManager.getUser()?.role === 'coach') {
            router.replace('/dashboard');
        }
    }, [router]);

    const [talentImportOpen, setTalentImportOpen] = useState(false);
    const [myTalents, setMyTalents] = useState<UserTalent[]>([]);
    const [talentViewMode, setTalentViewMode] = useState<'top5' | 'top15' | 'all' | 'bottom5'>('top15');
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userDetail, setUserDetail] = useState<UserDetailResponse | null>(null);

    // Manual editing state
    const [editingManual, setEditingManual] = useState(false);
    const [editFields, setEditFields] = useState<ManualFields>({ superpowers: '', motivators: '', blockers: '', feedback_style: '' });
    const [savingManual, setSavingManual] = useState(false);

    // AI generation state
    const [generating, setGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);

    useEffect(() => {
        const loadUserData = async () => {
            const user = tokenManager.getUser();
            setCurrentUser(user);

            if (user) {
                try {
                    const [userTalentsData, detail] = await Promise.all([
                        api.talents.getUserTalents(user.id),
                        api.users.getDetail(user.id),
                    ]);

                    const mappedTalents: UserTalent[] = userTalentsData.map((ut: { talent: { code: string }; rank: number }) => ({
                        talentId: ut.talent.code,
                        rank: ut.rank
                    }));

                    setMyTalents(mappedTalents);
                    setUserDetail(detail);
                } catch (error) {
                    console.error('Error fetching user data:', error);
                }
            }
        };

        const timer = setTimeout(loadUserData, 0);
        return () => clearTimeout(timer);
    }, []);

    const handleTalentsSave = async (talents: UserTalent[]) => {
        if (!currentUser) return;
        try {
            const rankings: Record<string, number> = {};
            talents.forEach(t => { rankings[t.talentId] = t.rank; });
            await api.gallup.saveTalents(currentUser.id, rankings, locale === 'en' ? 'en' : 'pl');
            setMyTalents(talents);
        } catch (error) {
            console.error('Error saving talents:', error);
            setMyTalents(talents);
        }
    };

    const startEditing = () => {
        const isEn = locale === 'en';
        setEditFields({
            superpowers: (isEn ? userDetail?.superpowers_en : userDetail?.superpowers) || '',
            motivators: (isEn ? userDetail?.motivators_en : userDetail?.motivators) || '',
            blockers: (isEn ? userDetail?.blockers_en : userDetail?.blockers) || '',
            feedback_style: (isEn ? userDetail?.feedback_style_en : userDetail?.feedback_style) || '',
        });
        setEditingManual(true);
        setGenerateError(null);
    };

    const cancelEditing = () => {
        setEditingManual(false);
        setGenerateError(null);
    };

    const saveManual = async () => {
        if (!currentUser || !userDetail) return;
        setSavingManual(true);
        try {
            const isEn = locale === 'en';
            const payload = isEn ? {
                superpowers_en: editFields.superpowers,
                motivators_en: editFields.motivators,
                blockers_en: editFields.blockers,
                feedback_style_en: editFields.feedback_style,
            } : {
                superpowers: editFields.superpowers,
                motivators: editFields.motivators,
                blockers: editFields.blockers,
                feedback_style: editFields.feedback_style,
            };
            await api.users.update(currentUser.id, payload);
            setUserDetail({ ...userDetail, ...payload });
            setEditingManual(false);
        } catch (error) {
            console.error('Error saving manual:', error);
        } finally {
            setSavingManual(false);
        }
    };

    const generateManual = async () => {
        if (!currentUser) return;
        setGenerating(true);
        setGenerateError(null);
        try {
            const result = await api.users.generateManual(currentUser.id, locale);
            // Fill edit fields with generated content and switch to edit mode
            setEditFields({
                superpowers: result.superpowers || '',
                motivators: result.motivators || '',
                blockers: result.blockers || '',
                feedback_style: result.feedback_style || '',
            });
            setEditingManual(true);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { detail?: string } } };
            const msg = err?.response?.data?.detail || 'Błąd generowania. Spróbuj ponownie.';
            setGenerateError(msg);
        } finally {
            setGenerating(false);
        }
    };

    const hasTalents = myTalents.length > 0;

    const getDominantDomain = (): GallupDomain | null => {
        if (!hasTalents) return null;
        const top5 = myTalents.filter(t => t.rank <= 5);
        const domainCounts = top5.reduce((acc, userTalent) => {
            const talent = GALLUP_TALENTS.find(t => t.code === userTalent.talentId);
            if (talent) acc[talent.domain] = (acc[talent.domain] || 0) + 1;
            return acc;
        }, {} as Record<GallupDomain, number>);

        const entries = Object.entries(domainCounts) as [GallupDomain, number][];
        if (entries.length === 0) return null;
        return entries.sort((a, b) => b[1] - a[1])[0][0];
    };

    const dominantDomain = getDominantDomain();

    return (
        <div className="w-full space-y-6">
            <TalentImportDialog
                open={talentImportOpen}
                onOpenChange={setTalentImportOpen}
                onSave={handleTalentsSave}
                initialTalents={myTalents}
                memberName={t('title')}
                userId={currentUser?.id}
            />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-headline">{t('title')}</h1>
                    <p className="text-body">{t('pageSubtitle')}</p>
                </div>
                {hasTalents && (
                    <Button variant="outline" onClick={() => setTalentImportOpen(true)}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        {t('editTalents')}
                    </Button>
                )}
            </div>

            {!hasTalents ? (
                <EmptyTalentsView onImport={() => setTalentImportOpen(true)} />
            ) : (
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left column - Talents + Manual */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Top Talents Card */}
                        <Card className="p-6 border-slate-200/60 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                                        <Trophy className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-title">{t('topTalentsTitle')}</h2>
                                        {dominantDomain && (
                                            <p className="text-sm text-muted-foreground">
                                                {t('dominantDomain')}: <span className="font-medium">
                                                    {locale === 'en' ? DOMAIN_LABELS[dominantDomain].en : DOMAIN_LABELS[dominantDomain].pl}
                                                </span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Tabs value={talentViewMode} onValueChange={(v) => setTalentViewMode(v as 'top5' | 'top15' | 'all' | 'bottom5')}>
                                    <TabsList className="h-8">
                                        <TabsTrigger value="top5" className="text-xs px-2 h-6">{t('viewTop5')}</TabsTrigger>
                                        <TabsTrigger value="top15" className="text-xs px-2 h-6">{t('viewTop15')}</TabsTrigger>
                                        <TabsTrigger value="all" className="text-xs px-2 h-6">{t('viewAll')}</TabsTrigger>
                                        <TabsTrigger value="bottom5" className="text-xs px-2 h-6">{t('viewBottom5')}</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                            <TalentListView talents={myTalents} viewMode={talentViewMode} locale={locale} />
                        </Card>

                        {/* User Manual header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">{t('userManual')}</h2>
                                <p className="text-sm text-muted-foreground">{t('manualSubtitle')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {generateError && (
                                    <p className="text-xs text-rose-500">{generateError}</p>
                                )}
                                {!editingManual && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={generateManual}
                                        disabled={generating}
                                        className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300"
                                    >
                                        {generating ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Sparkles className="h-4 w-4" />
                                        )}
                                        {generating ? t('generatingAI') : t('generateManual')}
                                    </Button>
                                )}
                                {!editingManual ? (
                                    <Button variant="outline" size="sm" onClick={startEditing} className="gap-2">
                                        <Pencil className="h-4 w-4" />
                                        {t('editManual')}
                                    </Button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={cancelEditing} className="gap-1.5">
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" onClick={saveManual} disabled={savingManual} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
                                            {savingManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                            {t('saveManual')}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {generating && (
                            <Card className="p-6 border-indigo-200 bg-indigo-50/40 shadow-sm">
                                <div className="flex items-center gap-3 text-indigo-700">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <p className="text-sm font-medium">{t('aiAnalyzing')}</p>
                                </div>
                            </Card>
                        )}

                        {/* Superpowers */}
                        <ManualSection
                            icon={<ThumbsUp className="h-5 w-5" />}
                            title={t('superpowersTitle')}
                            colorClass="bg-emerald-50/20 dark:bg-emerald-950/20"
                            iconColorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            value={userDetail?.superpowers}
                            placeholder={t('superpowersPlaceholder')}
                            emptyText={t('notFilledYet')}
                            editing={editingManual}
                            editValue={editFields.superpowers}
                            onEditChange={v => setEditFields(f => ({ ...f, superpowers: v }))}
                        />

                        {/* Motivators + Blockers side by side */}
                        <div className="grid gap-6 md:grid-cols-2">
                            <ManualSection
                                icon={<Smile className="h-5 w-5" />}
                                title={t('motivatorsTitle')}
                                colorClass="bg-amber-50/20 dark:bg-amber-950/20"
                                iconColorClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                value={userDetail?.motivators}
                                placeholder={t('motivatorsPlaceholder')}
                                emptyText={t('notFilledYet')}
                                editing={editingManual}
                                editValue={editFields.motivators}
                                onEditChange={v => setEditFields(f => ({ ...f, motivators: v }))}
                            />
                            <ManualSection
                                icon={<Ban className="h-5 w-5" />}
                                title={t('blockersTitle')}
                                colorClass="bg-rose-50/20 dark:bg-rose-950/20"
                                iconColorClass="bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                value={userDetail?.blockers}
                                placeholder={t('blockersPlaceholder')}
                                emptyText={t('notFilledYet')}
                                editing={editingManual}
                                editValue={editFields.blockers}
                                onEditChange={v => setEditFields(f => ({ ...f, blockers: v }))}
                            />
                        </div>

                        {/* Feedback style */}
                        <ManualSection
                            icon={<MessageCircle className="h-5 w-5" />}
                            title={t('feedbackStyleTitle')}
                            colorClass=""
                            iconColorClass="bg-primary/10 text-primary"
                            value={userDetail?.feedback_style}
                            placeholder={t('feedbackStylePlaceholder')}
                            emptyText={t('notFilledYet')}
                            editing={editingManual}
                            editValue={editFields.feedback_style}
                            onEditChange={v => setEditFields(f => ({ ...f, feedback_style: v }))}
                        />
                    </div>

                    {/* Right column - Domain Summary + Share */}
                    <div className="space-y-6">
                        {/* Domain Distribution */}
                        <Card className="p-6 border-slate-200/60 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                                    <Star className="h-5 w-5" />
                                </div>
                                <h2 className="text-title">{t('domainDistribution')}</h2>
                            </div>
                            <DomainSummary
                                talents={myTalents}
                                locale={locale}
                                talentsCountLabel={(count) => t('talentsCount', { count })}
                            />
                        </Card>

                        {/* Quick Tips */}
                        <Card className="p-6 border-slate-200/60 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="rounded-xl bg-domain-strategic-light p-2.5 text-domain-strategic">
                                    <Lightbulb className="h-5 w-5" />
                                </div>
                                <h2 className="text-title">{t('quickTips')}</h2>
                            </div>
                            <div className="space-y-3">
                                {[
                                    { icon: Target, domain: 'executing' as GallupDomain },
                                    { icon: Zap, domain: 'strategic_thinking' as GallupDomain },
                                    { icon: MessageCircle, domain: 'influencing' as GallupDomain },
                                    { icon: ThumbsUp, domain: 'relationship_building' as GallupDomain },
                                ].map((item, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "flex items-start gap-3 p-3 rounded-lg text-sm",
                                            item.domain === 'executing' && "bg-domain-executing-light text-domain-executing",
                                            item.domain === 'influencing' && "bg-domain-influencing-light text-domain-influencing",
                                            item.domain === 'relationship_building' && "bg-domain-relationship-light text-domain-relationship",
                                            item.domain === 'strategic_thinking' && "bg-domain-strategic-light text-domain-strategic",
                                        )}
                                    >
                                        <item.icon className="h-4 w-4 mt-0.5 shrink-0" />
                                        <span>{locale === 'en' ? DOMAIN_LABELS[item.domain].en : DOMAIN_LABELS[item.domain].pl}</span>
                                    </div>
                                ))}
                            </div>
                            <Button variant="outline" className="w-full mt-4" asChild>
                                <Link href="/dashboard/tips">
                                    {t('moreTips')}
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </Card>

                        {/* Share Profile Card */}
                        <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-slate-200/60 shadow-sm">
                            <h3 className="font-semibold mb-2">{t('shareProfile')}</h3>
                            <p className="text-sm text-muted-foreground mb-4">{t('shareProfileDesc')}</p>
                            {currentUser?.public_token || currentUser?.public_slug ? (
                                <div className="space-y-2">
                                    <Button variant="outline" className="w-full" asChild>
                                        <Link href={`/aboutme/${currentUser.public_slug || currentUser.public_token}`} target="_blank">
                                            {t('openBusinessCard')}
                                            <ChevronRight className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                    <Link
                                        href="/dashboard/settings/public-profile"
                                        className="block text-center text-xs text-muted-foreground hover:text-primary hover:underline"
                                    >
                                        {t('configureInSettings')}
                                    </Link>
                                </div>
                            ) : (
                                <Button variant="outline" className="w-full" asChild>
                                    <Link href="/dashboard/settings/public-profile">
                                        {t('configureInSettings')}
                                        <ChevronRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            )}
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
