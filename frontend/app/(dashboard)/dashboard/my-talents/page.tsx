"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { TalentImportDialog } from '@/components/talent-import/TalentImportDialog';
import { DOMAIN_LABELS, GALLUP_TALENTS } from '@/data/gallupTalents';
import { UserTalent, GallupDomain } from '@/types/talent';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { tokenManager, User } from '@/lib/api';
import {
    Upload,
    Sparkles,
    Star,
    ThumbsUp,
    AlertTriangle,
    Ban,
    MessageCircle,
    Lightbulb,
    Edit3,
    Trophy,
    Target,
    Zap,
    ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// Mock personal insights - would come from backend/AI
const mockPersonalInsights = {
    strengths: [
        'Naturalna zdolność do realizacji celów i dotrzymywania terminów',
        'Strategiczne podejście do rozwiązywania problemów',
        'Umiejętność szybkiego uczenia się nowych rzeczy',
        'Doskonała komunikacja i budowanie relacji',
    ],
    triggers: [
        'Brak jasno określonych celów lub priorytetów',
        'Chaos organizacyjny i brak struktury',
        'Ignorowanie faktów na rzecz emocji',
        'Zbyt szybkie tempo bez czasu na analizę',
    ],
    blockers: [
        'Zbyt dużo spotkań bez konkretnych rezultatów',
        'Mikrozarządzanie i brak autonomii',
        'Powtarzające się, rutynowe zadania',
        'Brak możliwości rozwoju i nauki',
    ],
    quickTips: [
        { icon: Target, tip: 'Zacznij dzień od ustalenia 3 najważniejszych celów', domain: 'executing' as GallupDomain },
        { icon: Zap, tip: 'Wykorzystaj swój talent Strateg do planowania spotkań', domain: 'strategic' as GallupDomain },
        { icon: MessageCircle, tip: 'Twoja komunikatywność to Twój atut - dziel się pomysłami', domain: 'influencing' as GallupDomain },
        { icon: ThumbsUp, tip: 'Buduj głębokie relacje, nie powierzchowne kontakty', domain: 'relationship' as GallupDomain },
    ],
    feedbackGuidance: 'Najlepiej przyjmuję feedback, który jest konkretny, oparty na faktach i zorientowany na rozwiązania. Doceniam szczere rozmowy z szacunkiem dla mojego czasu. Wolę otrzymać feedback bezpośrednio po sytuacji niż z opóźnieniem.',
};

interface TalentListViewProps {
    talents: UserTalent[];
    viewMode: 'top5' | 'top10' | 'all';
}

function TalentListView({ talents, viewMode }: TalentListViewProps) {
    const limit = viewMode === 'top5' ? 5 : viewMode === 'top10' ? 10 : 34;
    const displayTalents = talents.filter(t => t.rank <= limit).sort((a, b) => a.rank - b.rank);

    // Group by domain
    const groupedTalents = displayTalents.reduce((acc, userTalent) => {
        const talent = GALLUP_TALENTS.find(t => t.id === userTalent.talentId);
        if (talent) {
            if (!acc[talent.domain]) acc[talent.domain] = [];
            acc[talent.domain].push({ ...userTalent, talent });
        }
        return acc;
    }, {} as Record<GallupDomain, Array<UserTalent & { talent: typeof GALLUP_TALENTS[0] }>>);

    const domains: GallupDomain[] = ['executing', 'influencing', 'relationship', 'strategic'];

    return (
        <div className="space-y-4">
            {domains.map(domain => {
                const domainTalents = groupedTalents[domain];
                if (!domainTalents || domainTalents.length === 0) return null;

                return (
                    <div key={domain}>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            {DOMAIN_LABELS[domain].pl}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {domainTalents.map(({ talent, rank }) => (
                                <div
                                    key={talent.id}
                                    className={cn(
                                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                                        `domain-${domain}`
                                    )}
                                >
                                    <span
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                                        style={{ backgroundColor: `var(--color-domain-${domain})` }}
                                    >
                                        {rank}
                                    </span>
                                    {talent.namePl}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function DomainSummary({ talents }: { talents: UserTalent[] }) {
    const top10 = talents.filter(t => t.rank <= 10);

    const domainCounts = top10.reduce((acc, userTalent) => {
        const talent = GALLUP_TALENTS.find(t => t.id === userTalent.talentId);
        if (talent) {
            acc[talent.domain] = (acc[talent.domain] || 0) + 1;
        }
        return acc;
    }, {} as Record<GallupDomain, number>);

    const domains: GallupDomain[] = ['executing', 'influencing', 'relationship', 'strategic'];
    const maxCount = Math.max(...Object.values(domainCounts), 1);

    return (
        <div className="space-y-3">
            {domains.map(domain => {
                const count = domainCounts[domain] || 0;
                const percentage = (count / maxCount) * 100;

                return (
                    <div key={domain} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{DOMAIN_LABELS[domain].pl}</span>
                            <span className="text-muted-foreground">{count} talentów</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className={cn("h-full rounded-full transition-all", `bg-domain-${domain}`)}
                                style={{
                                    width: `${percentage}%`,
                                    // Fallback colors if classes don't work
                                    backgroundColor: `var(--color-domain-${domain})`
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
    return (
        <Card className="p-8 text-center">
            <div className="max-w-md mx-auto space-y-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold">Moje talenty Gallup</h2>
                    <p className="text-muted-foreground">
                        Importuj swój raport Gallup lub wprowadź talenty ręcznie, aby odblokować spersonalizowane wskazówki i analizy
                    </p>
                </div>
                <div className="space-y-3">
                    <Button size="lg" onClick={onImport} className="bg-gradient-primary hover:opacity-90 transition-opacity">
                        <Upload className="h-5 w-5 mr-2" />
                        Importuj talenty
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        Możesz zaimportować PDF z raportem Gallup lub wprowadzić talenty ręcznie
                    </p>
                </div>

                {/* Benefits preview */}
                <div className="pt-6 border-t space-y-3 text-left">
                    <p className="text-sm font-medium text-center text-muted-foreground">Co zyskasz?</p>
                    <div className="grid gap-3">
                        <div className="flex items-start gap-3 text-sm">
                            <div className="rounded-lg p-1.5 domain-executing">
                                <Star className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="font-medium">Analiza mocnych stron</p>
                                <p className="text-muted-foreground">Poznaj swoje naturalne talenty</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 text-sm">
                            <div className="rounded-lg p-1.5 domain-influencing">
                                <Lightbulb className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="font-medium">Spersonalizowane wskazówki</p>
                                <p className="text-muted-foreground">Codzienne porady dopasowane do Ciebie</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 text-sm">
                            <div className="rounded-lg p-1.5 domain-relationship">
                                <MessageCircle className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="font-medium">Instrukcja obsługi</p>
                                <p className="text-muted-foreground">Pomóż innym lepiej z Tobą współpracować</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}

export default function MyTalentsPage() {
    const [talentImportOpen, setTalentImportOpen] = useState(false);
    const [myTalents, setMyTalents] = useState<UserTalent[]>([]);
    const [talentViewMode, setTalentViewMode] = useState<'top5' | 'top10' | 'all'>('top10');
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            const user = tokenManager.getUser();
            setCurrentUser(user);
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    const handleTalentsSave = (talents: UserTalent[]) => {
        setMyTalents(talents);
    };

    const hasTalents = myTalents.length > 0;

    // Get dominant domain
    const getDominantDomain = (): GallupDomain | null => {
        if (!hasTalents) return null;
        const top5 = myTalents.filter(t => t.rank <= 5);
        const domainCounts = top5.reduce((acc, userTalent) => {
            const talent = GALLUP_TALENTS.find(t => t.id === userTalent.talentId);
            if (talent) {
                acc[talent.domain] = (acc[talent.domain] || 0) + 1;
            }
            return acc;
        }, {} as Record<GallupDomain, number>);

        const entries = Object.entries(domainCounts) as [GallupDomain, number][];
        if (entries.length === 0) return null;
        // Sort by count desc
        return entries.sort((a, b) => b[1] - a[1])[0][0];
    };

    const dominantDomain = getDominantDomain();

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <TalentImportDialog
                open={talentImportOpen}
                onOpenChange={setTalentImportOpen}
                onSave={handleTalentsSave}
                initialTalents={myTalents}
                memberName="Moje talenty"
                userId={currentUser?.id}
            />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-headline">Moje talenty</h1>
                    <p className="text-body">Twoje centrum talentów i wskazówek</p>
                </div>
                {hasTalents && (
                    <Button variant="outline" onClick={() => setTalentImportOpen(true)}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edytuj talenty
                    </Button>
                )}
            </div>

            {!hasTalents ? (
                <EmptyTalentsView onImport={() => setTalentImportOpen(true)} />
            ) : (
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left column - Talents */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Top Talents Card */}
                        <Card className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                                        <Trophy className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-title">Top talenty</h2>
                                        {dominantDomain && (
                                            <p className="text-sm text-muted-foreground">
                                                Dominująca domena: <span className="font-medium">{DOMAIN_LABELS[dominantDomain].pl}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Tabs value={talentViewMode} onValueChange={(v) => setTalentViewMode(v as 'top5' | 'top10' | 'all')}>
                                    <TabsList className="h-8">
                                        <TabsTrigger value="top5" className="text-xs px-2 h-6">Top 5</TabsTrigger>
                                        <TabsTrigger value="top10" className="text-xs px-2 h-6">Top 10</TabsTrigger>
                                        <TabsTrigger value="all" className="text-xs px-2 h-6">1-34</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                            <TalentListView talents={myTalents} viewMode={talentViewMode} />
                        </Card>

                        {/* Strengths */}
                        <Card className="p-6 bg-emerald-50/20 dark:bg-emerald-950/20">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
                                    <ThumbsUp className="h-5 w-5" />
                                </div>
                                <h2 className="text-title">Mocne strony</h2>
                            </div>
                            <ul className="space-y-2">
                                {mockPersonalInsights.strengths.map((strength, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm">
                                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                        {strength}
                                    </li>
                                ))}
                            </ul>
                        </Card>

                        {/* Two column grid for Triggers and Blockers */}
                        <div className="grid gap-6 md:grid-cols-2">
                            {/* Triggers */}
                            <Card className="p-6 bg-amber-50/20 dark:bg-amber-950/20">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400">
                                        <AlertTriangle className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-title">Wyzwalacze</h2>
                                </div>
                                <ul className="space-y-2">
                                    {mockPersonalInsights.triggers.map((trigger, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                            {trigger}
                                        </li>
                                    ))}
                                </ul>
                            </Card>

                            {/* Blockers */}
                            <Card className="p-6 bg-rose-50/20 dark:bg-rose-950/20">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="rounded-xl bg-rose-500/10 p-2.5 text-rose-600 dark:text-rose-400">
                                        <Ban className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-title">Blokady</h2>
                                </div>
                                <ul className="space-y-2">
                                    {mockPersonalInsights.blockers.map((blocker, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                                            {blocker}
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        </div>

                        {/* Feedback Guidance */}
                        <Card className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                                    <MessageCircle className="h-5 w-5" />
                                </div>
                                <h2 className="text-title">Jak dawać mi feedback</h2>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {mockPersonalInsights.feedbackGuidance}
                            </p>
                        </Card>
                    </div>

                    {/* Right column - Quick Tips & Domain Summary */}
                    <div className="space-y-6">
                        {/* Domain Distribution */}
                        <Card className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                                    <Star className="h-5 w-5" />
                                </div>
                                <h2 className="text-title">Rozkład domen</h2>
                            </div>
                            <DomainSummary talents={myTalents} />
                        </Card>

                        {/* Quick Tips */}
                        <Card className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="rounded-xl bg-domain-strategic-light p-2.5 text-domain-strategic">
                                    <Lightbulb className="h-5 w-5" />
                                </div>
                                <h2 className="text-title">Szybkie podpowiedzi</h2>
                            </div>
                            <div className="space-y-3">
                                {mockPersonalInsights.quickTips.map((item, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "flex items-start gap-3 p-3 rounded-lg text-sm",
                                            item.domain === 'executing' && "bg-domain-executing-light text-domain-executing",
                                            item.domain === 'influencing' && "bg-domain-influencing-light text-domain-influencing",
                                            item.domain === 'relationship' && "bg-domain-relationship-light text-domain-relationship",
                                            item.domain === 'strategic' && "bg-domain-strategic-light text-domain-strategic",
                                        )}
                                    >
                                        <item.icon className="h-4 w-4 mt-0.5 shrink-0" />
                                        <span>{item.tip}</span>
                                    </div>
                                ))}
                            </div>
                            <Button variant="outline" className="w-full mt-4" asChild>
                                <Link href="/dashboard/tips">
                                    Więcej wskazówek
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </Card>

                        {/* Share Profile Card */}
                        <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10">
                            <h3 className="font-semibold mb-2">Udostępnij swój profil</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Pozwól zespołowi lepiej zrozumieć Twoje talenty i preferencje współpracy
                            </p>
                            <Button variant="outline" className="w-full">
                                Generuj link do profilu
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
