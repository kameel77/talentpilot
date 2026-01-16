"use client";

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DomainBadge } from '@/components/ui/DomainBadge';
import { GALLUP_TALENTS, getTalentsByDomain, DOMAIN_LABELS } from '@/data/gallupTalents';
import { GallupDomain, UserTalent } from '@/types/talent';
import { Search, X, Lightbulb, Trophy, Star, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManualTalentInputProps {
    onSave: (talents: UserTalent[]) => void;
    initialTalents?: UserTalent[];
}

const DOMAINS: GallupDomain[] = ['executing', 'influencing', 'relationship', 'strategic'];

type RankingView = '5' | '10' | '34';

export function ManualTalentInput({ onSave, initialTalents = [] }: ManualTalentInputProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTalents, setSelectedTalents] = useState<UserTalent[]>(initialTalents);
    const [activeTab, setActiveTab] = useState<GallupDomain | 'all'>('all');
    const [rankingView, setRankingView] = useState<RankingView>('5');

    const filteredTalents = useMemo(() => {
        return GALLUP_TALENTS
            .filter((talent) => {
                const matchesSearch = talent.namePl.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    talent.name.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesDomain = activeTab === 'all' || talent.domain === activeTab;
                return matchesSearch && matchesDomain;
            })
            .sort((a, b) => a.namePl.localeCompare(b.namePl, 'pl'));
    }, [searchQuery, activeTab]);

    const getRank = (talentId: string) => selectedTalents.find(t => t.talentId === talentId)?.rank;

    const setRank = (talentId: string, rank: number | null) => {
        if (rank === null) {
            // Remove talent
            setSelectedTalents(prev => prev.filter(t => t.talentId !== talentId));
            return;
        }

        // Validate rank (1-34)
        if (rank < 1 || rank > 34) return;

        // Check if rank is already taken
        const existingWithRank = selectedTalents.find(t => t.rank === rank && t.talentId !== talentId);

        setSelectedTalents(prev => {
            let newTalents = prev.filter(t => t.talentId !== talentId);

            // If rank is taken, swap
            if (existingWithRank) {
                const oldRank = prev.find(t => t.talentId === talentId)?.rank;
                if (oldRank) {
                    newTalents = newTalents.map(t =>
                        t.talentId === existingWithRank.talentId
                            ? { ...t, rank: oldRank }
                            : t
                    );
                } else {
                    // Remove the talent that had this rank
                    newTalents = newTalents.filter(t => t.talentId !== existingWithRank.talentId);
                }
            }

            return [...newTalents, { talentId, rank }].sort((a, b) => a.rank - b.rank);
        });
    };

    const handleRankInput = (talentId: string, value: string) => {
        if (value === '') {
            setRank(talentId, null);
            return;
        }

        const rank = parseInt(value, 10);
        if (!isNaN(rank)) {
            setRank(talentId, rank);
        }
    };

    const clearAll = () => setSelectedTalents([]);

    const handleSave = () => {
        onSave(selectedTalents);
    };

    // Get ranked talents for the ranking view
    const rankedTalents = useMemo(() => {
        if (!selectedTalents) return [];
        const maxRank = parseInt(rankingView, 10);
        return selectedTalents
            .filter(t => t && t.rank <= maxRank)
            .sort((a, b) => a.rank - b.rank)
            .map(ut => {
                const talent = GALLUP_TALENTS.find(t => t.id === ut.talentId);
                return talent ? { ...ut, talent } : null;
            })
            .filter((t): t is (UserTalent & { talent: any }) => t !== null && !!t.talent);
    }, [selectedTalents, rankingView]);

    return (
        <div className="space-y-6">
            {/* Tip for users */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="font-medium text-foreground">Jak wprowadzić talenty?</p>
                    <p className="text-muted-foreground mt-1">
                        Przy każdym talencie wpisz jego pozycję z raportu Gallup (1-34).
                        Możesz wprowadzić tylko Top 5, Top 15 lub wszystkie 34 talenty.
                    </p>
                </div>
            </div>

            {/* Search and filter */}
            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Szukaj talentu..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* Domain tabs */}
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant={activeTab === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveTab('all')}
                    >
                        Wszystkie (34)
                    </Button>
                    {DOMAINS.map(domain => (
                        <Button
                            key={domain}
                            variant={activeTab === domain ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveTab(domain)}
                            className={cn(
                                activeTab === domain && domain === 'executing' && "bg-domain-executing hover:bg-domain-executing/90",
                                activeTab === domain && domain === 'influencing' && "bg-domain-influencing hover:bg-domain-influencing/90",
                                activeTab === domain && domain === 'relationship' && "bg-domain-relationship hover:bg-domain-relationship/90",
                                activeTab === domain && domain === 'strategic' && "bg-domain-strategic hover:bg-domain-strategic/90",
                                activeTab === domain && "text-white",
                                activeTab !== domain && domain === 'executing' && "hover:bg-domain-executing-light hover:text-domain-executing hover:border-domain-executing/30",
                                activeTab !== domain && domain === 'influencing' && "hover:bg-domain-influencing-light hover:text-domain-influencing hover:border-domain-influencing/30",
                                activeTab !== domain && domain === 'relationship' && "hover:bg-domain-relationship-light hover:text-domain-relationship hover:border-domain-relationship/30",
                                activeTab !== domain && domain === 'strategic' && "hover:bg-domain-strategic-light hover:text-domain-strategic hover:border-domain-strategic/30",
                            )}
                        >
                            {DOMAIN_LABELS[domain]?.pl || domain} ({getTalentsByDomain(domain).length})
                        </Button>
                    ))}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Available talents with rank input */}
                <div className="space-y-3">
                    <Label className="text-sm font-medium">
                        Wpisz pozycje dla talentów ({selectedTalents.length}/34)
                    </Label>
                    <ScrollArea className="h-[500px] rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
                        <div className="space-y-2">
                            {filteredTalents.map(talent => {
                                const rank = getRank(talent.id);
                                const hasRank = rank !== undefined;

                                return (
                                    <div
                                        key={talent.id}
                                        className={cn(
                                            "flex items-center gap-2 p-2 rounded-xl transition-all border",
                                            hasRank
                                                ? "bg-primary/10 border-primary/30"
                                                : "bg-slate-50 border-transparent hover:bg-slate-100"
                                        )}
                                    >
                                        {/* Rank input */}
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                min={1}
                                                max={34}
                                                value={rank ?? ''}
                                                onChange={(e) => handleRankInput(talent.id, e.target.value)}
                                                placeholder="#"
                                                className={cn(
                                                    "w-12 h-9 text-center font-bold text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                                    hasRank && "border-primary bg-primary/5"
                                                )}
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{talent.namePl}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">{talent.name}</p>
                                        </div>
                                        <div className="shrink-0">
                                            <DomainBadge domain={talent.domain} size="sm" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>

                {/* Ranked talents view */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <Label className="text-sm font-medium">
                            Twój ranking talentów
                        </Label>
                        <div className="flex items-center gap-2">
                            {/* Ranking view toggle */}
                            <div className="flex rounded-lg border bg-muted/50 p-1">
                                <button
                                    onClick={() => setRankingView('5')}
                                    className={cn(
                                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                        rankingView === '5'
                                            ? "bg-primary text-primary-foreground"
                                            : "hover:bg-background/80"
                                    )}
                                >
                                    Top5
                                </button>
                                <button
                                    onClick={() => setRankingView('10')}
                                    className={cn(
                                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                        rankingView === '10'
                                            ? "bg-primary text-primary-foreground"
                                            : "hover:bg-background/80"
                                    )}
                                >
                                    Top10
                                </button>
                                <button
                                    onClick={() => setRankingView('34')}
                                    className={cn(
                                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                        rankingView === '34'
                                            ? "bg-primary text-primary-foreground"
                                            : "hover:bg-background/80"
                                    )}
                                >
                                    1-34
                                </button>
                            </div>

                            {selectedTalents.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={clearAll}>
                                    <X className="h-4 w-4 mr-1" />
                                    Wyczyść
                                </Button>
                            )}
                        </div>
                    </div>

                    <ScrollArea className="h-[500px] rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
                        {rankedTalents.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-center text-muted-foreground">
                                <div className="space-y-2">
                                    <p className="text-sm">Brak talentów w wybranym zakresie</p>
                                    <p className="text-xs">Wpisz numer pozycji (1-{rankingView}) przy talencie po lewej</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {rankedTalents.map(({ talentId, rank, talent }) => (
                                    <div
                                        key={talentId}
                                    className="flex items-center gap-2 p-2 rounded-xl transition-all border bg-primary/10 border-primary/30"
                                >
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                value={rank}
                                                readOnly
                                                className="w-12 h-9 text-center font-bold text-sm border-primary bg-primary/5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{talent.namePl}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">{talent.name}</p>
                                        </div>
                                        <div className="shrink-0">
                                            <DomainBadge domain={talent.domain} size="sm" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground justify-center pt-2">
                        <div className="flex items-center gap-1.5">
                            <Trophy className="h-3.5 w-3.5 text-primary" />
                            <span>Top 5 - Dominujące</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Star className="h-3.5 w-3.5 text-primary/60" />
                            <span>6-10 - Wspierające</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Medal className="h-3.5 w-3.5 text-primary/40" />
                            <span>11-34 - Pozostałe</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Save button */}
            <div className="flex justify-end pt-4 border-t">
                <Button
                    variant="hero"
                    size="lg"
                    onClick={handleSave}
                    disabled={selectedTalents.length === 0}
                >
                    Zapisz ranking talentów ({selectedTalents.length})
                </Button>
            </div>
        </div>
    );
}
