"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getLocaleFromCookie } from "@/lib/locale";
import { api } from "@/lib/api";

import MatrixDashboard from "@/components/dashboard/MatrixDashboard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Trash2, ChevronDown, Check, Crown, Edit2, Upload, Search, FileText, X, Loader2, AlertTriangle } from "lucide-react";
import { GALLUP_TALENTS, DOMAIN_CSS_KEY } from "@/lib/gallup-data";
import { cn } from "@/lib/utils";


interface MemberResult {
    id: string | number;
    talent: string;
    domain: string;
    rank: number;
}

interface TeamMember {
    id: string | number;
    name: string;
    email?: string;
    role?: string;
    is_leader?: boolean;
    is_ghost?: boolean;
    invited_at?: string | null;
    invitation_status?: string;
    results: MemberResult[];
}

interface Talent {
    id: number;
    code: string;
    translation?: {
        name: string;
        description?: string;
    };
    domain: string;
}

interface GhostInvitePayload {
    team_id: number;
    full_name: string;
    email: string;
    job_title: string;
    talents?: {
        talent_id: number;
        rank: number;
    }[];
}

interface Team {
    id: number;
    name: string;
    description?: string;
}

export default function TeamDetailPage() {
    const t = useTranslations('teams');
    const tCommon = useTranslations('common');
    const locale = getLocaleFromCookie();

    const params = useParams();
    const teamId = parseInt(params.id as string);

    const router = useRouter();

    const [team, setTeam] = useState<Team | null>(null);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [allTalents, setAllTalents] = useState<Talent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showMatrix, setShowMatrix] = useState(false);

    // Add Member State
    const [showAddMember, setShowAddMember] = useState(false);
    const [memberForm, setMemberForm] = useState({ name: '', email: '', role: '' });
    const [selectedTalents, setSelectedTalents] = useState<number[]>([0, 0, 0, 0, 0]);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [error, setError] = useState("");

    // Edit Member State
    const [editingMember, setEditingMember] = useState<{ id: string | number, name: string, email: string, role: string } | null>(null);
    const [editError, setEditError] = useState('');
    const [conflictData, setConflictData] = useState<{
        existingUser: { id: number; full_name: string; email: string };
        ghostUserId: number;
    } | null>(null);
    const [replacingMember, setReplacingMember] = useState(false);
    const [membersSearch, setMembersSearch] = useState('');

    // PDF Import State
    const pdfImportRef = useRef<HTMLInputElement>(null);
    const triggerPdfImport = () => pdfImportRef.current?.click();
    type PdfImportStatus = 'pending' | 'processing' | 'success' | 'error';
    type PdfImportItem = { fileName: string; name: string | null; status: PdfImportStatus; error?: string };
    const [pdfImportItems, setPdfImportItems] = useState<PdfImportItem[]>([]);
    const [showPdfImport, setShowPdfImport] = useState(false);

    const loadTeamData = useCallback(async () => {
        try {
            setLoading(true);
            const [teamData, matrixData, talentsData, allTeamsData] = await Promise.all([
                api.teams.get(teamId),
                api.teams.getMatrix(teamId),
                api.talents.list(),
                api.teams.list(),
            ]);
            setTeam(teamData);
            setAllTeams(allTeamsData || []);
            setMembers(matrixData.members || []);
            setAllTalents(talentsData || []);
        } catch (err) {
            console.error("Failed to load team data", err);
        } finally {
            setLoading(false);
        }
    }, [teamId]);

    useEffect(() => {
        loadTeamData();
    }, [loadTeamData]);

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!memberForm.name || !memberForm.email) {
            setError(t('fullNameLabel') + " " + t('emailLabel'));
            return;
        }

        const validTalents = selectedTalents.filter(t => t > 0);
        if (validTalents.length > 0 && validTalents.length !== 5) {
            setError(t('top5TalentsOptional'));
            return;
        }

        try {
            setSubmitLoading(true);

            const payload: GhostInvitePayload = {
                team_id: teamId,
                full_name: memberForm.name,
                email: memberForm.email,
                job_title: memberForm.role,
            };

            if (validTalents.length === 5) {
                payload.talents = validTalents.map((tId, idx) => ({
                    talent_id: tId,
                    rank: idx + 1
                }));
            }

            await api.invitations.createGhostInvite(payload);

            setShowAddMember(false);
            setMemberForm({ name: '', email: '', role: '' });
            setSelectedTalents([0, 0, 0, 0, 0]);
            await loadTeamData();

        } catch (err: unknown) {
            console.error(err);
            const detail = (err as {response?: {data?: {detail?: string}}}).response?.data?.detail;
            setError(detail || tCommon('error'));
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleEditMemberSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMember) return;
        setEditError('');
        try {
            await api.users.update(editingMember.id as number, {
                full_name: editingMember.name,
                email: editingMember.email,
            });
            setEditingMember(null);
            await loadTeamData();
        } catch (err: unknown) {
            const axiosErr = err as { response?: { status?: number; data?: { detail?: { code?: string; existing_user?: { id: number; full_name: string; email: string }; message?: string } | string } } };
            if (axiosErr.response?.status === 409) {
                const detail = axiosErr.response.data?.detail;
                if (typeof detail === 'object' && detail?.code === 'EMAIL_CONFLICT' && detail.existing_user) {
                    setConflictData({
                        existingUser: detail.existing_user,
                        ghostUserId: editingMember.id as number,
                    });
                    setEditingMember(null);
                    return;
                }
            }
            const detail = axiosErr.response?.data?.detail;
            const msg = typeof detail === 'string' ? detail : typeof detail === 'object' && detail?.message ? detail.message : tCommon('error');
            setEditError(msg);
        }
    };

    const handleReplaceMember = async () => {
        if (!conflictData) return;
        setReplacingMember(true);
        try {
            await api.teams.replaceMember(teamId, conflictData.ghostUserId, conflictData.existingUser.id);
            setConflictData(null);
            await loadTeamData();
        } catch (err) {
            console.error(err);
            alert(tCommon('error'));
        } finally {
            setReplacingMember(false);
        }
    };

    const toggleLeader = async (member: TeamMember) => {
        const previousMembers = [...members];
        try {
            const newManagerId = member.is_leader ? null : parseInt(member.id as string, 10);

            // Optimistic update for UI responsiveness
            setMembers(members.map(m => ({
                ...m,
                is_leader: m.id === member.id ? (newManagerId !== null) : false
            })));

            await api.teams.update(teamId, { manager_id: newManagerId });
            await loadTeamData();
        } catch (err) {
            console.error(err);
            setMembers(previousMembers);
            alert(tCommon('error'));
        }
    };

    const onPdfImportSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (files.length === 0) return;

        const items: PdfImportItem[] = files.map(f => ({ fileName: f.name, name: null, status: 'pending' }));
        setPdfImportItems(items);
        setShowPdfImport(true);

        // Fetch fresh talents list from API - don't rely on allTalents state
        // which might be empty at call time (race condition)
        let currentTalents = allTalents;
        if (currentTalents.length === 0) {
            try {
                currentTalents = await api.talents.list();
                setAllTalents(currentTalents);
            } catch (err) {
                console.error('Failed to load talents for mapping:', err);
            }
        }

        for (let i = 0; i < files.length; i++) {
            setPdfImportItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'processing' } : it));
            try {
                const data = await api.gallup.parsePdf(files[i]);
                const name = `${data.first_name || ''} ${data.last_name || ''}`.trim() || files[i].name.replace('.pdf', '');

                const rankingsData = data.rankings || {};
                const mappedTalents = Object.entries(rankingsData).map(([talentCode, rank]) => {
                    const found = currentTalents.find(at => at.code === talentCode || at.translation?.name === talentCode);
                    return { talent_id: found?.id || 0, rank: rank as number };
                }).filter((t: { talent_id: number; rank: number }) => t.talent_id > 0);

                console.log(`[PdfImport] Parsed rankings for "${name}":`, rankingsData);
                console.log(`[PdfImport] Mapped ${mappedTalents.length}/${Object.keys(rankingsData).length} talents`, mappedTalents);
                if (mappedTalents.length === 0 && Object.keys(rankingsData).length > 0) {
                    console.warn('[PdfImport] WARNING: All talents failed to map! currentTalents.length =', currentTalents.length);
                }

                const payload: GhostInvitePayload = {
                    team_id: teamId,
                    full_name: name,
                    email: `user_${Date.now()}_${i}@example.com`,
                    job_title: '',
                };

                if (mappedTalents.length > 0) {
                    payload.talents = mappedTalents;
                }

                await api.invitations.createGhostInvite(payload);
                setPdfImportItems(prev => prev.map((it, idx) => idx === i ? { ...it, name, status: 'success' } : it));
            } catch (err: unknown) {
                const errorObj = err as { response?: { data?: { detail?: string } }, message?: string };
                const msg = errorObj.response?.data?.detail || errorObj.message || tCommon('error');
                setPdfImportItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'error', error: msg } : it));
            }
        }
        await loadTeamData();
    };

    const handleRemoveMember = async (userId: number) => {
        if (!confirm(t('confirmRemoveMember'))) return;
        try {
            await api.teams.removeMember(teamId, userId);
            await loadTeamData();
        } catch (err) {
            console.error(err);
            alert(tCommon('error'));
        }
    };

    const handleTalentChange = (index: number, talentId: number) => {
        const newTalents = [...selectedTalents];
        newTalents[index] = talentId;
        setSelectedTalents(newTalents);
    };

    const filteredMembers = members.filter(m =>
        m.name.toLowerCase().includes(membersSearch.toLowerCase()) ||
        (m.role || '').toLowerCase().includes(membersSearch.toLowerCase())
    );

    if (loading) {
        return <div className="text-gray-600">{tCommon('loading')}</div>;
    }

    if (!team) {
        return <div className="text-red-600">{tCommon('notFound')}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                    <div className="relative">
                        <button
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="flex items-center gap-2 text-3xl font-bold text-slate-900 mb-2 hover:opacity-80 transition-opacity"
                        >
                            <span className="truncate max-w-[300px] sm:max-w-md">{team.name}</span>
                            <ChevronDown className={`w-6 h-6 text-slate-400 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {dropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 shadow-xl rounded-xl z-20 py-2 overflow-hidden">
                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-100 mb-1">
                                        {t('switchContext')}
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {allTeams.length === 0 ? (
                                            <div className="px-4 py-3 text-sm text-slate-500 text-center">{t('noOtherTeams')}</div>
                                        ) : (
                                            allTeams.map(tm => (
                                                <button
                                                    key={tm.id}
                                                    onClick={() => {
                                                        setDropdownOpen(false);
                                                        if (tm.id !== team.id) {
                                                            router.push(`/dashboard/teams/${tm.id}`);
                                                        }
                                                    }}
                                                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors ${tm.id === team.id ? 'text-primary font-medium bg-blue-50/50 hover:bg-blue-50' : 'text-slate-700'}`}
                                                >
                                                    <span className="truncate">{tm.name}</span>
                                                    {tm.id === team.id && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    {team.description && (
                        <p className="text-slate-500">{team.description}</p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setShowMatrix(!showMatrix)}
                        className="rounded-lg font-medium"
                    >
                        {showMatrix ? t('hideMatrix') : t('showMatrix')}
                    </Button>

                    <Button
                        variant="secondary"
                        onClick={triggerPdfImport}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                        <Upload className="h-4 w-4" />
                        {t('importPdf')}
                    </Button>
                    <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
                        <DialogTrigger asChild>
                            <Button className="inline-flex items-center gap-2 rounded-xl bg-primary text-white shadow-sm">
                                <UserPlus className="h-4 w-4" />
                                {t('addMember')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{t('addMemberTitle')}</DialogTitle>
                                <DialogDescription>
                                    {t('addMemberDesc')}
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleAddMember} className="grid gap-4 mt-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">{t('fullNameLabel')}</Label>
                                    <Input
                                        id="name"
                                        value={memberForm.name}
                                        onChange={(e) => setMemberForm({...memberForm, name: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">{t('emailLabel')}</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={memberForm.email}
                                        onChange={(e) => setMemberForm({...memberForm, email: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="role">{t('roleLabel')}</Label>
                                    <Input
                                        id="role"
                                        value={memberForm.role}
                                        onChange={(e) => setMemberForm({...memberForm, role: e.target.value})}
                                    />
                                </div>

                                <div className="mt-4 border-t pt-4">
                                    <h4 className="text-sm font-semibold mb-3">{t('top5TalentsOptional')}</h4>
                                    <div className="space-y-3">
                                        {[1, 2, 3, 4, 5].map((rank, idx) => (
                                            <div key={rank} className="flex items-center gap-3">
                                                <div className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                                                    {rank}
                                                </div>
                                                <select
                                                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                    value={selectedTalents[idx]}
                                                    onChange={(e) => handleTalentChange(idx, parseInt(e.target.value))}
                                                >
                                                    <option value={0}>{t('selectTalent')}</option>
                                                    {allTalents.map(talent => {
                                                        const localTalent = GALLUP_TALENTS.find(gt => gt.code === talent.code || gt.en === talent.code || gt.pl === talent.code);
                                                        const translatedName = locale === 'en'
                                                            ? (localTalent?.en || talent.translation?.name || talent.code)
                                                            : (localTalent?.pl || talent.translation?.name || talent.code);
                                                        return (
                                                            <option key={talent.id} value={talent.id} disabled={selectedTalents.includes(talent.id) && selectedTalents[idx] !== talent.id}>
                                                                {translatedName}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {error && (
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                                        {error}
                                    </div>
                                )}
                                <div className="flex justify-end gap-3 mt-4 border-t pt-4">
                                    <Button type="button" variant="outline" onClick={() => setShowAddMember(false)}>
                                        {tCommon('cancel')}
                                    </Button>
                                    <Button type="submit" disabled={submitLoading}>
                                        {submitLoading ? t('adding') : tCommon('save')}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {showMatrix && (
                <MatrixDashboard members={members} />
            )}

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-6">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">
                            {t('membersTableTitle')} <span className="text-sm font-normal text-slate-500 ml-2">({members.length})</span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">{t('membersTableDesc')}</p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                placeholder={t('searchMember')}
                                className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-shadow bg-slate-50 focus:bg-white"
                                value={membersSearch}
                                onChange={(e) => setMembersSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {members.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <UserPlus className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-1">{t('noMembers')}</h3>
                        <p className="text-slate-500 max-w-sm mx-auto">
                            {t('teamEmptyDesc')}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200">
                                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('columnPerson')}</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('columnRole')}</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('columnTop5')}</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">{t('columnActions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredMembers.map((member) => {
                                    const top5 = [...member.results]
                                        .sort((a, b) => a.rank - b.rank)
                                        .slice(0, 5);

                                    return (
                                        <tr key={member.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="py-4 px-6">
                                                <Link href={`/dashboard/users/${member.id}`} className="flex items-center gap-3 group/link">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium shadow-sm shrink-0">
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-slate-900 group-hover/link:text-blue-600 transition-colors flex items-center gap-2">
                                                            {member.name}
                                                            {member.is_leader && (
                                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-600" title={t('manager')}>
                                                                    <Crown className="w-3 h-3" />
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-sm text-slate-500">{member.email || t('noEmailAddress')}</div>
                                                    </div>
                                                </Link>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="text-sm text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md inline-block">
                                                    {member.role || t('noRole')}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex flex-wrap gap-1.5 max-w-md">
                                                    {top5.length > 0 ? top5.map((tr) => {
                                                        const localTalentInfo = GALLUP_TALENTS.find(gt => gt.code === tr.talent || gt.en === tr.talent || gt.pl === tr.talent || gt.code.toLowerCase() === tr.talent.toLowerCase());
                                                        const translatedName = locale === 'en'
                                                            ? (localTalentInfo?.en || tr.talent)
                                                            : (localTalentInfo?.pl || tr.talent);
                                                        const translatedDesc = locale === 'en'
                                                            ? (localTalentInfo?.en_desc || undefined)
                                                            : (localTalentInfo?.pl_desc || undefined);

                                                        return (
                                                            <div
                                                                key={tr.talent}
                                                                className={cn(
                                                                    "relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:[&>.talent-tooltip]:opacity-100",
                                                                    `domain-${DOMAIN_CSS_KEY[tr.domain as keyof typeof DOMAIN_CSS_KEY] || tr.domain}`
                                                                )}
                                                            >
                                                                <span
                                                                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                                                                    style={{ backgroundColor: `var(--color-domain-${DOMAIN_CSS_KEY[tr.domain as keyof typeof DOMAIN_CSS_KEY] || tr.domain})` }}
                                                                >
                                                                    {tr.rank}
                                                                </span>
                                                                {translatedName}

                                                                {translatedDesc && (
                                                                    <div className="talent-tooltip pointer-events-none absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100 opacity-0 shadow-lg transition-opacity z-50 whitespace-normal text-center">
                                                                        {translatedDesc}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    }) : (
                                                        <span className="text-sm text-slate-400 italic">{t('noTalentsEntered')}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => toggleLeader(member)}
                                                        className={`p-2 rounded-lg transition-colors ${member.is_leader ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                                        title={member.is_leader ? t('noManager') : t('manager')}
                                                    >
                                                        <Crown className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingMember({ id: member.id, name: member.name, email: member.email || '', role: member.role || '' })}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title={tCommon('edit')}
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveMember(parseInt(member.id as string))}
                                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                        title={t('removeMember')}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredMembers.length === 0 && members.length > 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-slate-500">
                                            {t('searchNoResults')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Edit Member Dialog */}
            <Dialog open={!!editingMember} onOpenChange={(open) => { if (!open) { setEditingMember(null); setEditError(''); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('editMemberTitle')}</DialogTitle>
                    </DialogHeader>
                    {editingMember && (
                        <form onSubmit={handleEditMemberSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>{t('fullNameEditLabel')}</Label>
                                <Input value={editingMember.name} onChange={e => setEditingMember({...editingMember, name: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('emailEditLabel')}</Label>
                                <Input type="email" value={editingMember.email} onChange={e => setEditingMember({...editingMember, email: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('roleEditLabel')}</Label>
                                <Input value={editingMember.role} onChange={e => setEditingMember({...editingMember, role: e.target.value})} />
                            </div>
                            {editError && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                                    {editError}
                                </div>
                            )}
                            <div className="flex justify-end gap-3 pt-4">
                                <Button type="button" variant="outline" onClick={() => { setEditingMember(null); setEditError(''); }}>{tCommon('cancel')}</Button>
                                <Button type="submit">{t('saveChanges')}</Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Email Conflict — Replace Member Dialog */}
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
                                <Button variant="outline" onClick={() => setConflictData(null)} disabled={replacingMember}>
                                    {tCommon('cancel')}
                                </Button>
                                <Button onClick={handleReplaceMember} disabled={replacingMember}>
                                    {replacingMember ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('moving')}</>
                                    ) : (
                                        t('addToTeam')
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Hidden File Input for PDF Import */}
            <input
                type="file"
                multiple
                accept="application/pdf"
                className="hidden"
                ref={pdfImportRef}
                onChange={onPdfImportSelect}
            />

            {/* PDF Import Progress Dialog */}
            <Dialog open={showPdfImport} onOpenChange={setShowPdfImport}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('importingPdf')}</DialogTitle>
                        <DialogDescription>
                            {t('importingPdfDesc')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-3">
                        {pdfImportItems.map((item, idx) => (
                            <div key={idx} className={`p-3 rounded-xl border flex items-center gap-3 ${
                                item.status === 'success' ? 'bg-emerald-50 border-emerald-100' :
                                item.status === 'error' ? 'bg-rose-50 border-rose-100' :
                                item.status === 'processing' ? 'bg-blue-50 border-blue-100' :
                                'bg-slate-50 border-slate-100'
                            }`}>
                                <div className="shrink-0">
                                    {item.status === 'success' ? <Check className="w-5 h-5 text-emerald-500" /> :
                                     item.status === 'error' ? <X className="w-5 h-5 text-rose-500" /> :
                                     item.status === 'processing' ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" /> :
                                     <FileText className="w-5 h-5 text-slate-400" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-slate-900 truncate">
                                        {item.name || item.fileName}
                                    </p>
                                    <p className={`text-xs ${
                                        item.status === 'error' ? 'text-rose-600' : 'text-slate-500'
                                    }`}>
                                        {item.status === 'success' ? t('importSuccess') :
                                         item.status === 'error' ? (item.error || t('importError')) :
                                         item.status === 'processing' ? t('importProcessing') :
                                         t('importPending')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 flex justify-end">
                        <Button
                            onClick={() => setShowPdfImport(false)}
                            disabled={pdfImportItems.some(i => i.status === 'processing' || i.status === 'pending')}
                        >
                            {tCommon('close')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
