"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
    TriangleAlert,
    Ban,
    ChevronRight,
    Lightbulb,
    MessageCircle,
    Star,
    Target,
    ThumbsUp,
    Trophy,
    Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DOMAIN_LABELS, DOMAIN_CSS_KEY, GALLUP_TALENTS } from "@/lib/gallup-data";
import { api, tokenManager } from "@/lib/api";
import { cn } from "@/lib/utils";
import { GallupDomain } from '@/lib/gallup-data';
import { UserTalent } from '@/types/talent';

interface UserProfile {
    id: number;
    full_name: string;
    email: string;
    role: string;
    superpowers?: string;
    motivators?: string;
    blockers?: string;
    feedback_style?: string;
}

interface UserTalentResponse {
    id: number;
    rank: number;
    talent: {
        id: number;
        code: string;
        domain: string;
        translation: {
            name: string;
            description?: string;
        };
    };
}

interface TalentListViewProps {
    talents: UserTalent[];
    viewMode: "top5" | "top15" | "all";
    talentLookup: Map<string, { name: string; namePl: string; domain: GallupDomain }>;
}

function normalizeApiDomain(domain?: string): GallupDomain {
    if (!domain) return "executing";
    const normalized = domain.toLowerCase().replace(/\s+/g, "_");
    if (normalized.includes("strategic")) return "strategic_thinking";
    if (normalized.includes("relationship")) return "relationship_building";
    if (normalized.includes("influencing")) return "influencing";
    return "executing";
}

function TalentListView({ talents, viewMode, talentLookup }: TalentListViewProps) {
    const limit = viewMode === "top5" ? 5 : viewMode === "top15" ? 15 : 34;
    const displayTalents = talents
        .filter((t) => t.rank <= limit)
        .sort((a, b) => a.rank - b.rank);

    const groupedTalents = displayTalents.reduce((acc, userTalent) => {
        const talent = talentLookup.get(userTalent.talentId);
        if (talent) {
            if (!acc[talent.domain]) acc[talent.domain] = [];
            acc[talent.domain].push({ ...userTalent, talent });
        }
        return acc;
    }, {} as Record<GallupDomain, Array<UserTalent & { talent: { namePl: string; domain: GallupDomain } }>>);

    const domains: GallupDomain[] = ["executing", "influencing", "relationship_building", "strategic_thinking"];

    return (
        <div className="space-y-4">
            {domains.map((domain) => {
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
                                    key={`${talent.namePl}-${rank}`}
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

function DomainSummary({ talents, talentLookup }: { talents: UserTalent[]; talentLookup: Map<string, { domain: GallupDomain }> }) {
    const top15 = talents.filter((t) => t.rank <= 15);

    const domainCounts = top15.reduce((acc, userTalent) => {
        const talent = talentLookup.get(userTalent.talentId);
        if (talent) {
            acc[talent.domain] = (acc[talent.domain] || 0) + 1;
        }
        return acc;
    }, {} as Record<GallupDomain, number>);

    const domains: GallupDomain[] = ["executing", "influencing", "relationship_building", "strategic_thinking"];
    const maxCount = Math.max(...Object.values(domainCounts), 1);

    return (
        <div className="space-y-3">
            {domains.map((domain) => {
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
                                className={cn("h-full rounded-full transition-all", `bg-domain-${DOMAIN_CSS_KEY[domain]}`)}
                                style={{
                                    width: `${percentage}%`,
                                    backgroundColor: `var(--color-domain-${DOMAIN_CSS_KEY[domain]})`,
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

const quickTipTemplates = [
    (viewer: string, member: string, name: string) =>
        `Wykorzystaj swój talent ${viewer}, żeby ułatwić ${name} pracę z talentem ${member}.`,
    (viewer: string, member: string, name: string) =>
        `${name} ma silny talent ${member} — dopasuj komunikację, używając swojego ${viewer}.`,
    (viewer: string, member: string, name: string) =>
        `Łącząc Twój ${viewer} z ${member} u ${name}, szybciej uzgodnicie priorytety.`,
    (viewer: string, member: string, name: string) =>
        `W spotkaniach z ${name} opieraj się na swoim ${viewer}, by wzmocnić jego/jej ${member}.`,
];

const quickTipIcons: Record<GallupDomain, typeof Target> = {
    executing: Target,
    influencing: MessageCircle,
    relationship_building: ThumbsUp,
    strategic_thinking: Zap,
};

function parseBulletList(value?: string): string[] {
    if (!value) return [];
    return value
        .split(/\r?\n/)
        .map((line) => line.replace(/^[-•\s]+/, "").trim())
        .filter(Boolean);
}

export default function UserProfilePage() {
    const params = useParams();
    const userId = parseInt(params.id as string);

    const [user, setUser] = useState<UserProfile | null>(null);
    const [memberTalents, setMemberTalents] = useState<UserTalent[]>([]);
    const [memberTalentResponse, setMemberTalentResponse] = useState<UserTalentResponse[]>([]);
    const [currentUserTalents, setCurrentUserTalents] = useState<UserTalent[]>([]);
    const [talentViewMode, setTalentViewMode] = useState<"top5" | "top15" | "all">("top15");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadUserData = async () => {
            try {
                const [userData, talentsData] = await Promise.all([
                    api.users.get(userId),
                    api.talents.getUserTalents(userId),
                ]);
                setUser(userData);
                setMemberTalentResponse(talentsData);
                setMemberTalents(
                    talentsData.map((ut: UserTalentResponse) => ({
                        talentId: ut.talent.code,
                        rank: ut.rank,
                    }))
                );
            } catch (err) {
                console.error("Failed to load user data", err);
            } finally {
                setLoading(false);
            }
        };

        loadUserData();
    }, [userId]);

    useEffect(() => {
        const userData = tokenManager.getUser();
        if (!userData) return;

        const loadCurrentUserTalents = async () => {
            try {
                const talentsData = await api.talents.getUserTalents(userData.id);
                setCurrentUserTalents(
                    talentsData.map((ut: UserTalentResponse) => ({
                        talentId: ut.talent.code,
                        rank: ut.rank,
                    }))
                );
            } catch (err) {
                console.error("Failed to load current user talents", err);
            }
        };

        loadCurrentUserTalents();
    }, []);

    const talentLookup = useMemo(() => {
        const lookup = new Map<string, { name: string; namePl: string; domain: GallupDomain }>();
        GALLUP_TALENTS.forEach((talent) => {
            lookup.set(talent.code, {
                name: talent.en,
                namePl: talent.pl,
                domain: talent.domain as GallupDomain,
            });
        });
        memberTalentResponse.forEach((ut) => {
            if (lookup.has(ut.talent.code)) return;
            lookup.set(ut.talent.code, {
                name: ut.talent.translation?.name || ut.talent.code,
                namePl: ut.talent.translation?.name || ut.talent.code,
                domain: normalizeApiDomain(ut.talent.domain),
            });
        });
        return lookup;
    }, [memberTalentResponse]);

    const currentUserLookup = useMemo(() => {
        const lookup = new Map<string, { name: string; namePl: string; domain: GallupDomain }>();
        GALLUP_TALENTS.forEach((talent) => {
            lookup.set(talent.code, {
                name: talent.en,
                namePl: talent.pl,
                domain: talent.domain as GallupDomain,
            });
        });
        return lookup;
    }, []);

    const hasTalents = memberTalents.length > 0;

    const dominantDomain = useMemo(() => {
        if (!hasTalents) return null;
        const top5 = memberTalents.filter((t) => t.rank <= 5);
        const domainCounts = top5.reduce((acc, userTalent) => {
            const talent = talentLookup.get(userTalent.talentId);
            if (talent) {
                acc[talent.domain] = (acc[talent.domain] || 0) + 1;
            }
            return acc;
        }, {} as Record<GallupDomain, number>);

        const entries = Object.entries(domainCounts) as [GallupDomain, number][];
        if (entries.length === 0) return null;
        return entries.sort((a, b) => b[1] - a[1])[0][0];
    }, [hasTalents, memberTalents, talentLookup]);

    const quickTips = useMemo(() => {
        if (!user || currentUserTalents.length === 0 || memberTalents.length === 0) return [];
        const viewerTalents = [...currentUserTalents].sort((a, b) => a.rank - b.rank);
        const memberTop = [...memberTalents].sort((a, b) => a.rank - b.rank);

        return Array.from({ length: Math.min(4, viewerTalents.length, memberTop.length) }).map((_, index) => {
            const viewer = viewerTalents[index % viewerTalents.length];
            const member = memberTop[index % memberTop.length];
            const viewerTalent = currentUserLookup.get(viewer.talentId)?.namePl || viewer.talentId;
            const memberTalent = talentLookup.get(member.talentId)?.namePl || member.talentId;
            const memberDomain = talentLookup.get(member.talentId)?.domain || "executing";
            const template = quickTipTemplates[index % quickTipTemplates.length];
            const icon = quickTipIcons[memberDomain] || Target;

            return {
                icon,
                tip: template(viewerTalent, memberTalent, user.full_name),
                domain: memberDomain,
            };
        });
    }, [currentUserLookup, currentUserTalents, memberTalents, talentLookup, user]);

    if (loading) {
        return <div className="text-gray-600">Loading profile...</div>;
    }

    if (!user) {
        return <div className="text-red-600">User not found</div>;
    }

    const strengths = parseBulletList(user.superpowers);
    const motivators = parseBulletList(user.motivators);
    const blockers = parseBulletList(user.blockers);

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-headline">{user.full_name}</h1>
                    <p className="text-body">{user.email}</p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/dashboard/users">Wróć do zespołu</Link>
                </Button>
            </div>

            {!hasTalents ? (
                <Card className="p-8 text-center border-slate-200/60 shadow-sm">
                    <div className="max-w-md mx-auto space-y-4">
                        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                            <Star className="h-10 w-10 text-primary" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-semibold">Brak talentów w profilu</h2>
                            <p className="text-muted-foreground">
                                Ten członek zespołu nie ma jeszcze przypisanych talentów Gallupa.
                            </p>
                        </div>
                    </div>
                </Card>
            ) : (
                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="p-6 border-slate-200/60 shadow-sm">
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
                                <Tabs value={talentViewMode} onValueChange={(v) => setTalentViewMode(v as "top5" | "top15" | "all")}>
                                    <TabsList className="h-8">
                                        <TabsTrigger value="top5" className="text-xs px-2 h-6">Top 5</TabsTrigger>
                                        <TabsTrigger value="top15" className="text-xs px-2 h-6">Top 15</TabsTrigger>
                                        <TabsTrigger value="all" className="text-xs px-2 h-6">1-34</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                            <TalentListView talents={memberTalents} viewMode={talentViewMode} talentLookup={talentLookup} />
                        </Card>

                        <Card className="p-6 bg-emerald-50/20 dark:bg-emerald-950/20 border-slate-200/60 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
                                    <ThumbsUp className="h-5 w-5" />
                                </div>
                                <h2 className="text-title">Mocne strony</h2>
                            </div>
                            {strengths.length > 0 ? (
                                <ul className="space-y-2">
                                    {strengths.map((strength, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                            {strength}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground">Brak informacji o mocnych stronach.</p>
                            )}
                        </Card>

                        <div className="grid gap-6 md:grid-cols-2">
                            <Card className="p-6 bg-amber-50/20 dark:bg-amber-950/20 border-slate-200/60 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400">
                                        <TriangleAlert className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-title">Motywatory</h2>
                                </div>
                                {motivators.length > 0 ? (
                                    <ul className="space-y-2">
                                        {motivators.map((motivator, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm">
                                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                                {motivator}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Brak informacji o motywatorach.</p>
                                )}
                            </Card>

                            <Card className="p-6 bg-rose-50/20 dark:bg-rose-950/20 border-slate-200/60 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="rounded-xl bg-rose-500/10 p-2.5 text-rose-600 dark:text-rose-400">
                                        <Ban className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-title">Blokady</h2>
                                </div>
                                {blockers.length > 0 ? (
                                    <ul className="space-y-2">
                                        {blockers.map((blocker, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm">
                                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                                                {blocker}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Brak informacji o blokadach.</p>
                                )}
                            </Card>
                        </div>

                        <Card className="p-6 border-slate-200/60 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                                    <MessageCircle className="h-5 w-5" />
                                </div>
                                <h2 className="text-title">Jak dawać mi feedback</h2>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {user.feedback_style || "Brak informacji o preferowanym feedbacku."}
                            </p>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="p-6 border-slate-200/60 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                                    <Star className="h-5 w-5" />
                                </div>
                                <h2 className="text-title">Rozkład domen</h2>
                            </div>
                            <DomainSummary talents={memberTalents} talentLookup={talentLookup} />
                        </Card>

                        <Card className="p-6 border-slate-200/60 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="rounded-xl bg-domain-strategic-light p-2.5 text-domain-strategic">
                                    <Lightbulb className="h-5 w-5" />
                                </div>
                                <h2 className="text-title">Szybkie podpowiedzi</h2>
                            </div>
                            {quickTips.length > 0 ? (
                                <div className="space-y-3">
                                    {quickTips.map((item, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "flex items-start gap-3 p-3 rounded-lg text-sm",
                                                item.domain === "executing" && "bg-domain-executing-light text-domain-executing",
                                                item.domain === "influencing" && "bg-domain-influencing-light text-domain-influencing",
                                                item.domain === "relationship_building" && "bg-domain-relationship-light text-domain-relationship",
                                                item.domain === "strategic_thinking" && "bg-domain-strategic-light text-domain-strategic"
                                            )}
                                        >
                                            <item.icon className="h-4 w-4 mt-0.5 shrink-0" />
                                            <span>{item.tip}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Dodaj swoje talenty, aby otrzymać podpowiedzi dopasowane do {user.full_name}.
                                </p>
                            )}
                            <Button variant="outline" className="w-full mt-4" asChild>
                                <Link href="/dashboard/tips">
                                    Więcej wskazówek
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </Card>

                        <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-slate-200/60 shadow-sm">
                            <h3 className="font-semibold mb-2">Udostępnij profil</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Ułatw zespołowi współpracę z {user.full_name} dzięki szybkiemu dostępowi do profilu talentów.
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
