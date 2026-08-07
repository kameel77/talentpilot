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
    Pencil,
    Upload,
    Edit3,
    X,
    Sparkles,
    Loader2,
    Save,
    Power,
    UserCog,
    AlertTriangle,
} from "lucide-react";

import { useTranslations } from "next-intl";
import { isPlaceholderEmail } from "@/lib/utils";
import { getLocaleFromCookie } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DOMAIN_LABELS, DOMAIN_CSS_KEY, GALLUP_TALENTS } from "@/lib/gallup-data";
import { api, tokenManager } from "@/lib/api";
import { cn } from "@/lib/utils";
import { GallupDomain } from '@/lib/gallup-data';
import { UserTalent } from '@/types/talent';
import { TalentImportDialog } from '@/components/talent-import/TalentImportDialog';

interface UserProfile {
    id: number;
    full_name: string;
    email: string;
    role: string;
    job_title?: string;
    is_active?: boolean;
    is_ghost?: boolean;
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
    locale: string;
}

function normalizeApiDomain(domain?: string): GallupDomain {
    if (!domain) return "executing";
    const normalized = domain.toLowerCase().replace(/\s+/g, "_");
    if (normalized.includes("strategic")) return "strategic_thinking";
    if (normalized.includes("relationship")) return "relationship_building";
    if (normalized.includes("influencing")) return "influencing";
    return "executing";
}

function TalentListView({ talents, viewMode, talentLookup, locale }: TalentListViewProps) {
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
    }, {} as Record<GallupDomain, Array<UserTalent & { talent: { name: string; namePl: string; domain: GallupDomain } }>>);

    const domains: GallupDomain[] = ["executing", "influencing", "relationship_building", "strategic_thinking"];

    return (
        <div className="space-y-4">
            {domains.map((domain) => {
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
                                    {locale === 'en' ? talent.name : talent.namePl}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function DomainSummary({ talents, talentLookup, locale }: { talents: UserTalent[]; talentLookup: Map<string, { domain: GallupDomain }>; locale: string }) {
    const t = useTranslations('users');
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
                            <span className="font-medium">{locale === 'en' ? DOMAIN_LABELS[domain].en : DOMAIN_LABELS[domain].pl}</span>
                            <span className="text-muted-foreground">{t('talentsCount', { count })}</span>
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

const quickTipKeys = ['quickTip0', 'quickTip1', 'quickTip2', 'quickTip3'] as const;

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
    const t = useTranslations('users');
    const locale = getLocaleFromCookie();
    const params = useParams();
    const userId = parseInt(params.id as string);

    const [user, setUser] = useState<UserProfile | null>(null);
    const [memberTalents, setMemberTalents] = useState<UserTalent[]>([]);
    const [memberTalentResponse, setMemberTalentResponse] = useState<UserTalentResponse[]>([]);
    const [currentUserTalents, setCurrentUserTalents] = useState<UserTalent[]>([]);
    const [talentViewMode, setTalentViewMode] = useState<"top5" | "top15" | "all">("top15");
    const [loading, setLoading] = useState(true);
    const [canEdit, setCanEdit] = useState(false);
    const [talentImportOpen, setTalentImportOpen] = useState(false);

    // Editing state for each section
    const [editingSection, setEditingSection] = useState<string | null>(null);
    const [editValues, setEditValues] = useState({
        superpowers: '',
        motivators: '',
        blockers: '',
        feedback_style: '',
    });
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);

    // Edit profile state
    const [editProfileOpen, setEditProfileOpen] = useState(false);
    const [editProfileData, setEditProfileData] = useState({ full_name: '', email: '', job_title: '' });
    const [editProfileSaving, setEditProfileSaving] = useState(false);
    const [editProfileError, setEditProfileError] = useState('');
    const [conflictData, setConflictData] = useState<{
        existingUser: { id: number; full_name: string; email: string };
    } | null>(null);
    const [replacingUser, setReplacingUser] = useState(false);

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

                // Check if current user can edit this profile
                const currentUserData = tokenManager.getUser();
                if (currentUserData) {
                    const role = currentUserData.role;
                    const isSelf = currentUserData.id === userId;
                    setCanEdit(isSelf || role === 'admin' || role === 'coach' || role === 'manager');
                }
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

    const handleTalentsSave = async (talents: UserTalent[]) => {
        try {
            const rankings: Record<string, number> = {};
            talents.forEach(t => { rankings[t.talentId] = t.rank; });
            await api.gallup.saveTalents(userId, rankings, 'pl');
            setMemberTalents(talents);
            // Reload full talent data for display
            const talentsData = await api.talents.getUserTalents(userId);
            setMemberTalentResponse(talentsData);
            setMemberTalents(
                talentsData.map((ut: UserTalentResponse) => ({
                    talentId: ut.talent.code,
                    rank: ut.rank,
                }))
            );
        } catch (error) {
            console.error('Error saving talents:', error);
            setMemberTalents(talents);
        }
    };

    const startEditing = (section: string) => {
        if (!user) return;
        setEditValues({
            superpowers: user.superpowers || '',
            motivators: user.motivators || '',
            blockers: user.blockers || '',
            feedback_style: user.feedback_style || '',
        });
        setEditingSection(section);
    };

    const cancelEditing = () => {
        setEditingSection(null);
    };

    const saveSection = async (section: string) => {
        if (!user) return;
        setSaving(true);
        try {
            const updateData: Record<string, string> = {};
            updateData[section] = editValues[section as keyof typeof editValues];
            const updatedUser = await api.users.update(userId, updateData);
            setUser(updatedUser as unknown as UserProfile);
            setEditingSection(null);
        } catch (err) {
            console.error('Failed to save section', err);
            alert(t('saveError'));
        } finally {
            setSaving(false);
        }
    };

    const generateWithAI = async () => {
        if (!user) return;
        setGenerating(true);
        try {
            const generated = await api.users.generateManual(userId, locale);
            const updatedUser = await api.users.update(userId, {
                superpowers: generated.superpowers,
                motivators: generated.motivators,
                blockers: generated.blockers,
                feedback_style: generated.feedback_style,
            });
            setUser(updatedUser as unknown as UserProfile);
            setEditingSection(null);
        } catch (err) {
            console.error('AI generation failed', err);
            alert(t('aiError'));
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return <div className="text-gray-600">Loading profile...</div>;
    }

    if (!user) {
        return <div className="text-red-600">User not found</div>;
    }

    const strengths = parseBulletList(user.superpowers);
    const motivators = parseBulletList(user.motivators);
    const blockers = parseBulletList(user.blockers);

    const dominantDomain = (() => {
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
    })();

    const quickTips = (() => {
        if (!user || currentUserTalents.length === 0 || memberTalents.length === 0) return [];
        const viewerTalents = [...currentUserTalents].sort((a, b) => a.rank - b.rank);
        const memberTop = [...memberTalents].sort((a, b) => a.rank - b.rank);
        return Array.from({ length: Math.min(4, viewerTalents.length, memberTop.length) }).map((_, index) => {
            const viewer = viewerTalents[index % viewerTalents.length];
            const member = memberTop[index % memberTop.length];
            const viewerEntry = currentUserLookup.get(viewer.talentId);
            const memberEntry = talentLookup.get(member.talentId);
            const viewerTalent = (locale === 'en' ? viewerEntry?.name : viewerEntry?.namePl) || viewer.talentId;
            const memberTalent = (locale === 'en' ? memberEntry?.name : memberEntry?.namePl) || member.talentId;
            const memberDomain = memberEntry?.domain || "executing";
            const tipKey = quickTipKeys[index % quickTipKeys.length];
            const icon = quickTipIcons[memberDomain] || Target;
            return { icon, tip: t(tipKey, { viewer: viewerTalent, member: memberTalent, name: user.full_name }), domain: memberDomain };
        });
    })();

    const renderEditableSection = (
        sectionKey: string,
        title: string,
        items: string[],
        emptyText: string,
        icon: React.ReactNode,
        bgClass: string,
        dotColor: string
    ) => {
        const isEditing = editingSection === sectionKey;
        return (
            <Card className={cn("p-6 border-slate-200/60 shadow-sm", bgClass)}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {icon}
                        <h2 className="text-title">{title}</h2>
                    </div>
                    {canEdit && !isEditing && (
                        <Button variant="ghost" size="sm" onClick={() => startEditing(sectionKey)} className="text-slate-400 hover:text-slate-600">
                            <Pencil className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                {isEditing ? (
                    <div className="space-y-3">
                        <textarea
                            className="w-full min-h-[120px] rounded-lg border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y bg-white"
                            value={editValues[sectionKey as keyof typeof editValues]}
                            onChange={(e) => setEditValues(prev => ({ ...prev, [sectionKey]: e.target.value }))}
                            placeholder={t('editSectionPlaceholder', { title: title.toLowerCase() })}
                        />
                        <div className="flex items-center gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={saving}>
                                <X className="h-4 w-4 mr-1" /> {t('editSectionCancel')}
                            </Button>
                            <Button size="sm" onClick={() => saveSection(sectionKey)} disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                                {t('editSectionSave')}
                            </Button>
                        </div>
                    </div>
                ) : items.length > 0 ? (
                    <ul className="space-y-2">
                        {items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                                <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", dotColor)} />
                                {item}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">{emptyText}</p>
                )}
            </Card>
        );
    };

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            {/* Talent Import Dialog */}
            <TalentImportDialog
                open={talentImportOpen}
                onOpenChange={setTalentImportOpen}
                onSave={handleTalentsSave}
                initialTalents={memberTalents}
                memberName={user.full_name}
                userId={userId}
            />

            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-headline">{user.full_name}</h1>
                        {user.is_active === false && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">INACTIVE</span>
                        )}
                    </div>
                    <p className="text-body">{isPlaceholderEmail(user.email) ? "—" : user.email}</p>
                    {user.job_title && <p className="text-sm text-muted-foreground mt-0.5">{user.job_title}</p>}
                </div>
                <div className="flex items-center gap-2">
                    {canEdit && (
                        <>
                            <Button variant="outline" onClick={() => {
                                setEditProfileData({
                                    full_name: user.full_name || '',
                                    email: user.email || '',
                                    job_title: user.job_title || '',
                                });
                                setEditProfileError('');
                                setEditProfileOpen(true);
                            }}>
                                <UserCog className="h-4 w-4 mr-2" />
                                {t('editProfile')}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={async () => {
                                    try {
                                        const newStatus = !(user.is_active !== false);
                                        await api.users.update(userId, { is_active: newStatus });
                                        setUser(prev => prev ? { ...prev, is_active: newStatus } : prev);
                                    } catch (err) {
                                        console.error(err);
                                    }
                                }}
                                className={user.is_active !== false
                                    ? 'text-amber-600 border-amber-200 hover:bg-amber-50'
                                    : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                                }
                            >
                                <Power className="h-4 w-4 mr-2" />
                                {user.is_active !== false ? t('archiveUser') : t('activateUser')}
                            </Button>
                        </>
                    )}
                    {canEdit && hasTalents && (
                        <>
                            <Button variant="outline" onClick={() => setTalentImportOpen(true)}>
                                <Edit3 className="h-4 w-4 mr-2" />
                                {t('editTalents')}
                            </Button>
                            <Button variant="outline" onClick={generateWithAI} disabled={generating}>
                                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                                {generating ? t('generating') : t('generateWithAI')}
                            </Button>
                        </>
                    )}
                    <Button variant="outline" asChild>
                        <Link href="/dashboard/users">{t('backToTeam')}</Link>
                    </Button>
                </div>
            </div>

            {!hasTalents ? (
                <Card className="p-8 text-center border-slate-200/60 shadow-sm">
                    <div className="max-w-md mx-auto space-y-6">
                        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                            <Star className="h-10 w-10 text-primary" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-semibold">{t('noTalentsInProfile')}</h2>
                            <p className="text-muted-foreground">
                                {t('noTalentsInProfileDesc')}
                            </p>
                        </div>
                        {canEdit && (
                            <div className="space-y-3">
                                <Button size="lg" onClick={() => setTalentImportOpen(true)} className="bg-gradient-primary hover:opacity-90 transition-opacity">
                                    <Upload className="h-5 w-5 mr-2" />
                                    {t('importTalents')}
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                    {t('importTalentsHint')}
                                </p>
                            </div>
                        )}
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
                                        <h2 className="text-title">{t('topTalents')}</h2>
                                        {dominantDomain && (
                                            <p className="text-sm text-muted-foreground">
                                                {t('dominantDomain')}: <span className="font-medium">{locale === 'en' ? DOMAIN_LABELS[dominantDomain].en : DOMAIN_LABELS[dominantDomain].pl}</span>
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
                            <TalentListView talents={memberTalents} viewMode={talentViewMode} talentLookup={talentLookup} locale={locale} />
                        </Card>

                        {renderEditableSection(
                            'superpowers',
                            t('strengths'),
                            strengths,
                            t('noStrengths'),
                            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400"><ThumbsUp className="h-5 w-5" /></div>,
                            'bg-emerald-50/20 dark:bg-emerald-950/20',
                            'bg-emerald-500'
                        )}

                        <div className="grid gap-6 md:grid-cols-2">
                            {renderEditableSection(
                                'motivators',
                                t('motivators'),
                                motivators,
                                t('noMotivators'),
                                <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400"><TriangleAlert className="h-5 w-5" /></div>,
                                'bg-amber-50/20 dark:bg-amber-950/20',
                                'bg-amber-500'
                            )}

                            {renderEditableSection(
                                'blockers',
                                t('blockers'),
                                blockers,
                                t('noBlockers'),
                                <div className="rounded-xl bg-rose-500/10 p-2.5 text-rose-600 dark:text-rose-400"><Ban className="h-5 w-5" /></div>,
                                'bg-rose-50/20 dark:bg-rose-950/20',
                                'bg-rose-500'
                            )}
                        </div>

                        {renderEditableSection(
                            'feedback_style',
                            t('feedbackStyle'),
                            user.feedback_style ? [user.feedback_style] : [],
                            t('noFeedbackStyle'),
                            <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><MessageCircle className="h-5 w-5" /></div>,
                            '',
                            'bg-primary'
                        )}
                    </div>

                    <div className="space-y-6">
                        <Card className="p-6 border-slate-200/60 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                                    <Star className="h-5 w-5" />
                                </div>
                                <h2 className="text-title">{t('domainDistribution')}</h2>
                            </div>
                            <DomainSummary talents={memberTalents} talentLookup={talentLookup} locale={locale} />
                        </Card>

                        <Card className="p-6 border-slate-200/60 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="rounded-xl bg-domain-strategic-light p-2.5 text-domain-strategic">
                                    <Lightbulb className="h-5 w-5" />
                                </div>
                                <h2 className="text-title">{t('quickTips')}</h2>
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
                                    {t('addYourTalentsHint', { name: user.full_name })}
                                </p>
                            )}
                            <Button variant="outline" className="w-full mt-4" asChild>
                                <Link href="/dashboard/tips">
                                    {t('moreTips')}
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </Card>

                        <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-slate-200/60 shadow-sm">
                            <h3 className="font-semibold mb-2">{t('shareProfile')}</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                {t('shareProfileDesc', { name: user.full_name })}
                            </p>
                            <Button variant="outline" className="w-full">
                                {t('generateProfileLink')}
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </Card>
                    </div>
                </div>
            )}

            {/* Edit Profile Dialog */}
            <Dialog open={editProfileOpen} onOpenChange={(open) => { if (!open) { setEditProfileOpen(false); setEditProfileError(''); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('editProfileTitle')}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        setEditProfileSaving(true);
                        setEditProfileError('');
                        try {
                            await api.users.update(userId, {
                                full_name: editProfileData.full_name,
                                email: editProfileData.email,
                                job_title: editProfileData.job_title || undefined,
                            });
                            setUser(prev => prev ? {
                                ...prev,
                                full_name: editProfileData.full_name,
                                email: editProfileData.email,
                                job_title: editProfileData.job_title,
                            } : prev);
                            setEditProfileOpen(false);
                        } catch (err: unknown) {
                            const axiosErr = err as { response?: { status?: number; data?: { detail?: { code?: string; existing_user?: { id: number; full_name: string; email: string }; message?: string } | string } } };
                            if (axiosErr.response?.status === 409) {
                                const detail = axiosErr.response.data?.detail;
                                if (typeof detail === 'object' && detail?.code === 'EMAIL_CONFLICT' && detail.existing_user) {
                                    setConflictData({ existingUser: detail.existing_user });
                                    setEditProfileOpen(false);
                                    setEditProfileSaving(false);
                                    return;
                                }
                            }
                            const detail = axiosErr.response?.data?.detail;
                            const msg = typeof detail === 'string' ? detail : typeof detail === 'object' && detail?.message ? detail.message : t('saveProfileError');
                            setEditProfileError(msg);
                        } finally {
                            setEditProfileSaving(false);
                        }
                    }} className="space-y-4">
                        <div className="space-y-2">
                            <Label>{t('fullName')}</Label>
                            <Input value={editProfileData.full_name} onChange={e => setEditProfileData(prev => ({ ...prev, full_name: e.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('email')}</Label>
                            <Input type="email" value={editProfileData.email} onChange={e => setEditProfileData(prev => ({ ...prev, email: e.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('jobTitle')}</Label>
                            <Input value={editProfileData.job_title} onChange={e => setEditProfileData(prev => ({ ...prev, job_title: e.target.value }))} placeholder="e.g. Product Manager" />
                        </div>
                        {editProfileError && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                                {editProfileError}
                            </div>
                        )}
                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => { setEditProfileOpen(false); setEditProfileError(''); }}>{t('cancel')}</Button>
                            <Button type="submit" disabled={editProfileSaving}>
                                {editProfileSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('saving')}</> : t('saveChanges')}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Email Conflict — Replace User Dialog */}
            <Dialog open={!!conflictData} onOpenChange={(open) => !open && setConflictData(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            {t('emailConflictTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('emailConflictDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    {conflictData && (
                        <div className="space-y-4 mt-2">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium shadow-sm shrink-0">
                                        {conflictData.existingUser.full_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-900">{conflictData.existingUser.full_name}</p>
                                        <p className="text-sm text-slate-500">{conflictData.existingUser.email}</p>
                                    </div>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600">
                                {t('emailConflictBody')}
                            </p>
                            <div className="flex justify-end gap-3 pt-2">
                                <Button variant="outline" onClick={() => setConflictData(null)} disabled={replacingUser}>
                                    {t('cancel')}
                                </Button>
                                <Button onClick={async () => {
                                    setReplacingUser(true);
                                    try {
                                        const result = await api.users.replaceUser(userId, conflictData.existingUser.id);
                                        setConflictData(null);
                                        // Redirect to the existing user's profile
                                        window.location.href = `/dashboard/users/${result.user.id}`;
                                    } catch (err) {
                                        console.error(err);
                                        alert(t('swapError'));
                                    } finally {
                                        setReplacingUser(false);
                                    }
                                }} disabled={replacingUser}>
                                    {replacingUser ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('transferring')}</>
                                    ) : (
                                        t('replaceAndTransfer')
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
