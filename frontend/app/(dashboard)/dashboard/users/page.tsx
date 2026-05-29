"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { api, GhostInviteRequest, Talent, Team, tokenManager } from "@/lib/api";
import { cn } from "@/lib/utils";
import { KPICard } from "@/components/ui/KPICard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, UserPlus, Shield, UserCheck, Power, Trash2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

interface UserSummary {
    id: number;
    full_name: string;
    email: string;
    role: string;
    is_active?: boolean;
    is_ghost?: boolean;
}

export default function UsersPage() {
    const t = useTranslations('users');
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [talents, setTalents] = useState<Talent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [inviteOpen, setInviteOpen] = useState(false);
    const [teamOpen, setTeamOpen] = useState(false);
    const [inviteError, setInviteError] = useState("");
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteToken, setInviteToken] = useState<string | null>(null);
    const [inviteData, setInviteData] = useState({
        email: "",
        full_name: "",
        job_title: "",
        team_id: "",
        talents: Array(5).fill(""),
    });
    const [teamError, setTeamError] = useState("");
    const [teamLoading, setTeamLoading] = useState(false);
    const [teamData, setTeamData] = useState({
        name: "",
        description: "",
    });

    useEffect(() => {
        loadUsers();
        loadTeams();
        loadTalents();
    }, []);

    const currentUser = tokenManager.getUser();
    const isAdmin = currentUser?.role === "admin";
    const isCoach = currentUser?.role === "coach";
    const canManage = isAdmin || isCoach;

    // Delete user state
    const [deleteTarget, setDeleteTarget] = useState<UserSummary | null>(null);
    const [deleting, setDeleting] = useState(false);

    const handleDeleteUser = async () => {
        if (!deleteTarget) return;
        try {
            setDeleting(true);
            await api.users.delete(deleteTarget.id);
            setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch {
            setError(t('deleteUser'));
        } finally {
            setDeleting(false);
        }
    };

    const loadUsers = async () => {
        try {
            const data = await api.users.list();
            setUsers(data);
        } catch {
            setError("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    const loadTeams = async () => {
        try {
            const data = await api.teams.list();
            setTeams(data);
        } catch {
            setTeams([]);
        }
    };

    const loadTalents = async () => {
        try {
            const data = await api.talents.list();
            setTalents(data);
        } catch {
            setTalents([]);
        }
    };

    const sortedTalents = useMemo(() => {
        return [...talents].sort((a, b) =>
            a.translation.name.localeCompare(b.translation.name, "pl")
        );
    }, [talents]);

    const resetInvite = () => {
        setInviteData({
            email: "",
            full_name: "",
            job_title: "",
            team_id: "",
            talents: Array(5).fill(""),
        });
        setInviteError("");
        setInviteToken(null);
    };

    const resetTeam = () => {
        setTeamData({
            name: "",
            description: "",
        });
        setTeamError("");
    };

    const handleCreateTeam = async () => {
        setTeamError("");

        if (!teamData.name.trim()) {
            setTeamError("Team name is required.");
            return;
        }

        try {
            setTeamLoading(true);
            await api.teams.create({
                name: teamData.name.trim(),
                description: teamData.description.trim() || undefined,
            });
            await loadTeams();
            setTeamOpen(false);
            resetTeam();
        } catch {
            setTeamError("Failed to create team. Please try again.");
        } finally {
            setTeamLoading(false);
        }
    };

    const handleInviteSubmit = async () => {
        setInviteError("");
        setInviteToken(null);

        if (!inviteData.email || !inviteData.full_name || !inviteData.team_id) {
            setInviteError("Email, name, and team are required.");
            return;
        }

        const selectedTalents = inviteData.talents.filter(Boolean);
        if (selectedTalents.length > 0 && selectedTalents.length !== 5) {
            setInviteError("Select exactly 5 talents or leave all empty.");
            return;
        }

        const uniqueTalentIds = new Set(selectedTalents);
        if (uniqueTalentIds.size !== selectedTalents.length) {
            setInviteError("Talents must be unique.");
            return;
        }

        const payload: GhostInviteRequest = {
            email: inviteData.email,
            full_name: inviteData.full_name,
            job_title: inviteData.job_title || undefined,
            team_id: Number(inviteData.team_id),
            talents: selectedTalents.length
                ? selectedTalents.map((talentId, index) => ({
                      talent_id: Number(talentId),
                      rank: index + 1,
                  }))
                : undefined,
        };

        try {
            setInviteLoading(true);
            const response = await api.invitations.createGhostInvite(payload);
            setInviteToken(response.invite_token);
            await loadUsers();
        } catch {
            setInviteError("Failed to create invite. Please try again.");
        } finally {
            setInviteLoading(false);
        }
    };

    const inviteLink = inviteToken && typeof window !== "undefined"
        ? `${window.location.origin}/join?token=${inviteToken}`
        : null;

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm font-medium text-slate-500">Loading your team...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">{t('title')}</h1>
                    <p className="mt-2 text-slate-500 max-w-2xl">
                        Manage your organization&apos;s members, assign roles, and track talent development progress across teams.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Dialog open={teamOpen} onOpenChange={(open) => {
                        setTeamOpen(open);
                        if (!open) resetTeam();
                    }}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="inline-flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                New Team
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Create a team</DialogTitle>
                                <DialogDescription>
                                    Teams help you organize members and comparisons.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="team-name">Team name</Label>
                                    <Input
                                        id="team-name"
                                        placeholder="Product"
                                        value={teamData.name}
                                        onChange={(event) =>
                                            setTeamData((prev) => ({ ...prev, name: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="team-description">Description (optional)</Label>
                                    <Input
                                        id="team-description"
                                        placeholder="Core product team"
                                        value={teamData.description}
                                        onChange={(event) =>
                                            setTeamData((prev) => ({ ...prev, description: event.target.value }))
                                        }
                                    />
                                </div>
                                {teamError && (
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                                        {teamError}
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-3 justify-end">
                                    <Button type="button" variant="outline" onClick={() => setTeamOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="button" onClick={handleCreateTeam} disabled={teamLoading}>
                                        {teamLoading ? "Creating..." : "Create team"}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={inviteOpen} onOpenChange={(open) => {
                    setInviteOpen(open);
                    if (!open) resetInvite();
                }}>
                        <DialogTrigger asChild>
                            <Button className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-sm hover:shadow-md active:scale-95">
                                <UserPlus className="h-4 w-4" />
                                Invite User
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Invite team member</DialogTitle>
                                <DialogDescription>
                                    Add a ghost profile and generate a 7-day invite link.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="invite-email">Email</Label>
                                    <Input
                                        id="invite-email"
                                        type="email"
                                        placeholder="user@company.com"
                                        value={inviteData.email}
                                        onChange={(event) =>
                                            setInviteData((prev) => ({ ...prev, email: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="invite-name">Full name</Label>
                                    <Input
                                        id="invite-name"
                                        placeholder="Jane Doe"
                                        value={inviteData.full_name}
                                        onChange={(event) =>
                                            setInviteData((prev) => ({ ...prev, full_name: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="invite-title">Job title (optional)</Label>
                                    <Input
                                        id="invite-title"
                                        placeholder="Product Manager"
                                        value={inviteData.job_title}
                                        onChange={(event) =>
                                            setInviteData((prev) => ({ ...prev, job_title: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="invite-team">Team</Label>
                                    <select
                                        id="invite-team"
                                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                        value={inviteData.team_id}
                                        onChange={(event) =>
                                            setInviteData((prev) => ({ ...prev, team_id: event.target.value }))
                                        }
                                    >
                                        <option value="">Select team</option>
                                        {teams.map((team) => (
                                            <option key={team.id} value={team.id}>
                                                {team.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid gap-3">
                                    <div>
                                        <Label>Talents (Top 5)</Label>
                                        <p className="text-xs text-slate-500">Optional. Fill all five or leave empty.</p>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {inviteData.talents.map((talentId, index) => (
                                            <div key={`talent-${index}`} className="grid gap-1">
                                                <Label className="text-xs text-slate-500">Rank {index + 1}</Label>
                                                <select
                                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                                    value={talentId}
                                                    onChange={(event) => {
                                                        const value = event.target.value;
                                                        setInviteData((prev) => {
                                                            const next = [...prev.talents];
                                                            next[index] = value;
                                                            return { ...prev, talents: next };
                                                        });
                                                    }}
                                                >
                                                    <option value="">Select talent</option>
                                                    {sortedTalents.map((talent) => {
                                                        const selectedElsewhere = inviteData.talents.some(
                                                            (selected, selectedIndex) =>
                                                                selectedIndex !== index && selected === talent.id.toString()
                                                        );
                                                        return (
                                                            <option
                                                                key={talent.id}
                                                                value={talent.id}
                                                                disabled={selectedElsewhere}
                                                            >
                                                                {talent.translation.name}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {inviteError && (
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                                        {inviteError}
                                    </div>
                                )}
                                {inviteLink && (
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                        <p className="font-semibold">Invite link (valid 7 days)</p>
                                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                                            <Input readOnly value={inviteLink} />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => navigator.clipboard.writeText(inviteLink)}
                                            >
                                                Copy
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-3 justify-end">
                                    <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="button" onClick={handleInviteSubmit} disabled={inviteLoading}>
                                        {inviteLoading ? "Creating..." : "Generate link"}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Metrics Overview */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard
                    title="Total Users"
                    value={users.length}
                    icon={<Users className="h-5 w-5" />}
                />
                <KPICard
                    title="Active Now"
                    value={users.filter(u => u.is_active !== false).length}
                    icon={<UserCheck className="h-5 w-5" />}
                    trend={{ value: 12, isUp: true }}
                />
                <KPICard
                    title="Admins"
                    value={users.filter(u => u.role.toLowerCase() === 'admin').length}
                    icon={<Shield className="h-5 w-5" />}
                />
                <KPICard
                    title="Avg Talents/User"
                    value="5.2"
                    description="CliftonStrengths Top 5"
                />
            </div>

            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-700 animate-fade-up">
                    {error}
                </div>
            )}

            {users.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-16 text-center animate-fade-up">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <Users className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">{t('noUsers')}</h3>
                    <p className="mt-2 text-slate-500 max-w-xs mx-auto">
                        Your organization is empty. Start by inviting your first team member.
                    </p>
                    <button
                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
                        onClick={() => setInviteOpen(true)}
                    >
                        <UserPlus className="h-4 w-4" />
                        {t('addUser')}
                    </button>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 animate-fade-up">
                    {users.map((user) => (
                        <div
                            key={user.id}
                            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5"
                        >
                            <Link href={`/dashboard/users/${user.id}`}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-primary transition-colors">
                                            <span className="text-lg font-bold font-heading">
                                                {user.full_name.charAt(0)}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors">
                                                {user.full_name}
                                            </h3>
                                            <p className="text-xs text-slate-400 font-medium">{user.email}</p>
                                        </div>
                                    </div>
                                    <span className={cn(
                                        "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                        user.role.toLowerCase() === 'admin'
                                            ? "bg-amber-50 text-amber-600 border border-amber-100"
                                            : "bg-blue-50 text-blue-600 border border-blue-100"
                                    )}>
                                        {user.role}
                                    </span>
                                </div>
                            </Link>

                            <div className="mt-8 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <div className={cn(
                                        "h-2 w-2 rounded-full",
                                        user.is_active !== false ? "bg-emerald-500" : "bg-slate-300"
                                    )} />
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                                        {user.is_active !== false ? t('active') : t('inactive')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {canManage && user.id !== currentUser?.id && (
                                        <>
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    try {
                                                        await api.users.update(user.id, { is_active: user.is_active === false });
                                                        setUsers((prev) =>
                                                            prev.map((u) =>
                                                                u.id === user.id
                                                                    ? { ...u, is_active: u.is_active === false }
                                                                    : u
                                                            )
                                                        );
                                                    } catch {
                                                        setError("Failed to update user status");
                                                    }
                                                }}
                                                className={cn(
                                                    "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-tight transition-all",
                                                    user.is_active !== false
                                                        ? "text-amber-600 hover:bg-amber-50 border border-amber-200"
                                                        : "text-emerald-600 hover:bg-emerald-50 border border-emerald-200"
                                                )}
                                                title={user.is_active !== false ? t('archiveUser') : t('activateUser')}
                                            >
                                                <Power className="h-3 w-3" />
                                                {user.is_active !== false ? t('archiveUser') : t('activateUser')}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteTarget(user);
                                                }}
                                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-tight text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all"
                                                title={t('deleteUser')}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                                {t('deleteUser')}
                                            </button>
                                        </>
                                    )}
                                    <Link
                                        href={`/dashboard/users/${user.id}`}
                                        className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                                    >
                                        {t('viewProfile')}
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete User Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('confirmDeleteTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('confirmDelete')} <strong>{deleteTarget?.full_name}</strong> ({deleteTarget?.email})
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteUser}
                            disabled={deleting}
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            {deleting ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('deleting')}</>
                            ) : (
                                <><Trash2 className="h-4 w-4 mr-2" />{t('deletePermanent')}</>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
