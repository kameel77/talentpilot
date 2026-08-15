"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getLocaleFromCookie } from "@/lib/locale";
import { api, tokenManager, Talent } from "@/lib/api";

import MatrixDashboard from "@/components/dashboard/MatrixDashboard";
import MemberReportUpload from "@/components/dashboard/MemberReportUpload";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Trash2, ChevronDown, Check, Crown, Edit2, Upload, Search, FileText, X, Loader2, AlertTriangle } from "lucide-react";
import { GALLUP_TALENTS, getDomainStyle, GallupDomain } from "@/lib/gallup-data";
import { isPlaceholderEmail, getApiErrorMessage } from "@/lib/utils";


interface MemberResult {
    id: string | number;
    talent: string;
    domain: string;
    rank: number;
}

interface TeamMember {
    id: number;
    name: string;
    email: string;
    role?: string;
    is_leader?: boolean;
    is_ghost?: boolean;
    invitation_status?: string;
    results: MemberResult[];
}

interface GhostInvitePayload {
    team_id: number;
    full_name: string;
    email?: string;
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
    const tInv = useTranslations('invitations');
    const locale = getLocaleFromCookie();
    const [resendingId, setResendingId] = useState<string | number | null>(null);

    const params = useParams();
    const teamId = parseInt(params.id as string);

    const router = useRouter();

    const [team, setTeam] = useState<Team | null>(null);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [allTalents, setAllTalents] = useState<Talent[]>([]);
    const [loading, setLoading] = useState(true);

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
    const [membersExpanded, setMembersExpanded] = useState(false);

    // PDF Import State
    const pdfImportRef = useRef<HTMLInputElement>(null);
    const triggerPdfImport = async () => {
        const canAdd = await api.billing.checkLimit('profiles');
        if (!canAdd) return;
        pdfImportRef.current?.click();
    };
    const handleOpenAddMember = async () => {
        const canAdd = await api.billing.checkLimit('profiles');
        if (!canAdd) return;
        setShowAddMember(true);
    };
    type PdfImportStatus = 'pending' | 'processing' | 'success' | 'error';
    type PdfImportItem = {
        fileName: string;
        name: string | null;
        status: PdfImportStatus;
        error?: string;
        topTalents?: Array<{ code: string; name: string; domain?: GallupDomain }>;
    };
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
            const msg = getApiErrorMessage(err, tCommon('error'));
            setError(msg);
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
            const msg = getApiErrorMessage(err, tCommon('error'));
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
            const newManagerId = member.is_leader ? null : Number(member.id);

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

    const handleBatchUpload = async (files: FileList | File[]) => {
        if (!files || files.length === 0) return;
        setPdfImportItems(Array.from(files).map(f => ({ fileName: f.name, name: null, status: 'pending' })));
        setShowPdfImport(true);

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
                const data = await api.gallup.parsePdf(files[i], locale, 'new_profile');
                const name = `${data.first_name || ''} ${data.last_name || ''}`.trim() || files[i].name.replace('.pdf', '');

                const rankingsData = data.rankings || {};
                const mappedTalents = Object.entries(rankingsData).map(([talentCode, rank]) => {
                    const found = currentTalents.find(at => at.code === talentCode || at.translation?.name === talentCode);
                    return { talent_id: found?.id || 0, rank: rank as number };
                }).filter((t: { talent_id: number; rank: number }) => t.talent_id > 0);

                const topTalents = Object.entries(rankingsData)
                    .sort((a, b) => (a[1] as number) - (b[1] as number))
                    .slice(0, 5)
                    .map(([talentCode]) => {
                        const found = currentTalents.find(at => at.code === talentCode || at.translation?.name === talentCode);
                        const gt = GALLUP_TALENTS.find(g => g.code === talentCode);
                        return {
                            code: talentCode,
                            name: found?.translation?.name || (locale === 'en' ? gt?.en : gt?.pl) || talentCode,
                            domain: gt?.domain,
                        };
                    });

                const payload: GhostInvitePayload = {
                    team_id: teamId,
                    full_name: name,
                    job_title: '',
                };

                if (mappedTalents.length > 0) {
                    payload.talents = mappedTalents;
                }

                await api.invitations.createGhostInvite(payload);
                setPdfImportItems(prev => prev.map((it, idx) => idx === i ? { ...it, name, status: 'success', topTalents } : it));
            } catch (err: unknown) {
                console.error(err);
                const msg = getApiErrorMessage(err, tCommon('error'));
                setPdfImportItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'error', error: msg } : it));
            }
        }
        await loadTeamData();
    };

    const onPdfImportSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (files.length === 0) return;
        const canAdd = await api.billing.checkLimit('profiles', files.length);
        if (!canAdd) return;
        await handleBatchUpload(files);
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

    const handleResend = async (memberId: string | number) => {
        setResendingId(memberId);
        try {
            await api.invitations.resendInvitation(parseInt(memberId as string));
            await loadTeamData();
        } catch (err) {
            console.error("Failed to resend invitation", err);
        } finally {
            setResendingId(null);
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

    const getStatusBadge = (member: TeamMember) => {
        const status = member.invitation_status ?? 'active';
        const colorMap: Record<string, string> = {
            active: 'bg-green-100 text-green-700',
            not_invited: 'bg-slate-100 text-slate-400',
            invited: 'bg-yellow-100 text-yellow-700',
            expired: 'bg-gray-100 text-gray-500',
        };
        return (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorMap[status] ?? colorMap.active}`}>
                {tInv(`status.${status}`)}
            </span>
        );
    };

    if (loading) {
        return <div className="text-gray-600">{tCommon('loading')}</div>;
    }

    if (!team) {
        return <div className="text-red-600">{tCommon('notFound')}</div>;
    }

    const currentUser = tokenManager.getUser();
    const isPrivileged = !!currentUser && ['coach', 'admin', 'manager'].includes(currentUser.role);
    const isTeamLeader = !!currentUser && members.some(m => m.is_leader && Number(m.id) === currentUser.id);
    const canSeeRisks = isPrivileged || isTeamLeader;

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
                        variant="secondary"
                        onClick={triggerPdfImport}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                        <Upload className="h-4 w-4" />
                        {t('importPdf')}
                    </Button>
                    <Button
                        onClick={handleOpenAddMember}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary text-white shadow-sm"
                    >
                        <UserPlus className="h-4 w-4" />
                        {t('addMember')}
                    </Button>
                    <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
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
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 space-y-2">
                                        <p>{error}</p>
                                        <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
                                            <Link href="/dashboard/settings/billing" className="font-semibold underline hover:text-rose-900">
                                                Sprawdź plany i limity
                                            </Link>
                                            <Link href="/dashboard" className="text-slate-600 hover:underline">
                                                Wróć do Dashboardu
                                            </Link>
                                        </div>
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

            <MatrixDashboard members={members} canSeeRisks={canSeeRisks} talents={allTalents} />

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-6">
                <button
                    type="button"
                    onClick={() => setMembersExpanded(!membersExpanded)}
                    className="w-full p-6 flex items-center justify-between text-left"
                >
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">
                            {t('membersTableTitle')} <span className="text-sm font-normal text-slate-500 ml-2">({members.length})</span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">{t('membersTableDesc')}</p>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${membersExpanded ? 'rotate-180' : ''}`} />
                </button>
                {membersExpanded && (
                    <div className="border-t border-slate-100">
                        <div className="p-6 pb-0 flex flex-col sm:flex-row sm:items-center justify-end gap-4">
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
                                            <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('columnTalents')}</th>
                                            <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">{t('columnActions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredMembers.map((member) => {
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
                                                                 <div className="flex items-center gap-2 mt-0.5">
                                                                    <div className="text-sm text-slate-500">{isPlaceholderEmail(member.email) ? '—' : (member.email || t('noEmailAddress'))}</div>
                                                                    {member.is_ghost && getStatusBadge(member)}
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <span className="text-sm text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md inline-block">
                                                            {member.role || t('noRole')}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        {member.results.length > 0 ? (
                                                            <span className="text-sm text-emerald-600 font-medium">
                                                                ✓ {t('talentsLoadedCount', { count: member.results.length })}
                                                            </span>
                                                        ) : (
                                                            <span className="text-sm text-slate-400 italic">{t('noTalentsEntered')}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {member.is_ghost && member.invitation_status !== 'active' && !isPlaceholderEmail(member.email) && (
                                                                <button
                                                                    onClick={() => handleResend(member.id)}
                                                                    disabled={resendingId === member.id}
                                                                    className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                                                                    title={member.invitation_status === 'not_invited' ? tInv('invite') : tInv('resend')}
                                                                >
                                                                    {resendingId === member.id ? (
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                    ) : (
                                                                        <span className="text-xs font-medium px-1">
                                                                            {member.invitation_status === 'not_invited' ? tInv('invite') : tInv('resend')}
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            )}
                                                            {isPrivileged && (
                                                                <MemberReportUpload
                                                                    userId={Number(member.id)}
                                                                    memberName={member.name}
                                                                    onDone={loadTeamData}
                                                                />
                                                            )}
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
                                                                onClick={() => handleRemoveMember(Number(member.id))}
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
                                    {item.topTalents && item.topTalents.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {item.topTalents.map((talent, tIdx) => (
                                                <span
                                                    key={talent.code || tIdx}
                                                    className="text-[10px] font-semibold border px-1.5 py-0.5 rounded-md"
                                                    style={{
                                                        background: talent.domain ? getDomainStyle(talent.domain, 15) : '#f1f5f9',
                                                        color: talent.domain ? getDomainStyle(talent.domain) : '#475569',
                                                        borderColor: talent.domain ? getDomainStyle(talent.domain, 30) : '#cbd5e1',
                                                    }}
                                                >
                                                    {tIdx + 1}. {talent.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <p className={`text-xs mt-1 ${
                                        item.status === 'error' ? 'text-rose-600 font-medium' : 'text-slate-500'
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

                    {pdfImportItems.some(item => item.status === 'error') && (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1.5">
                            <p className="font-semibold">Dlaczego wystąpił błąd?</p>
                            <p>
                                Dodanie niektórych osób mogło zostać zablokowane z powodu limitu Twojego obecnego planu (np. limit profili w planie Free) lub problemu z odczytem pliku PDF.
                            </p>
                            <div className="pt-1 flex flex-wrap items-center gap-3">
                                <Link href="/dashboard/settings/billing" className="font-semibold underline hover:text-amber-950">
                                    Sprawdź plany i limity
                                </Link>
                                <Link href="/dashboard" className="text-slate-600 hover:underline">
                                    Wróć do Dashboardu
                                </Link>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2">
                        <Button
                            variant="outline"
                            asChild
                            className="w-full sm:w-auto"
                        >
                            <Link href="/dashboard">
                                Wróć do Dashboardu
                            </Link>
                        </Button>
                        <Button
                            onClick={() => setShowPdfImport(false)}
                            disabled={pdfImportItems.some(i => i.status === 'processing' || i.status === 'pending')}
                            className="w-full sm:w-auto"
                        >
                            {tCommon('close')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
