"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { api, tokenManager, type Team } from "@/lib/api";
import { Users, Plus, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";

interface OrgOption {
    id: number;
    name: string;
}

export default function TeamsPage() {
    const t = useTranslations('teams');
    const tCommon = useTranslations('common');

    const [teams, setTeams] = useState<Team[]>([]);
    const [orgs, setOrgs] = useState<OrgOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const currentUser = tokenManager.getUser();
    const canCreate = currentUser?.role === "admin" || currentUser?.role === "coach";

    // Create-team modal
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [organizationId, setOrganizationId] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        try {
            setLoading(true);
            const [teamsData, orgsData] = await Promise.all([
                api.teams.list(),
                api.auth.getMyOrganizations(),
            ]);
            setTeams(teamsData);
            setOrgs(orgsData);
        } catch {
            setError(t('loadError'));
        } finally {
            setLoading(false);
        }
    };

    const openModal = () => {
        setName("");
        setOrganizationId("");
        setCreateError(null);
        setOpen(true);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError(null);

        if (!organizationId) {
            setCreateError(t('selectOrgError'));
            return;
        }

        try {
            setCreating(true);
            const created = await api.teams.create({
                name: name.trim(),
                organization_id: Number(organizationId),
            });
            setTeams([created, ...teams]);
            setOpen(false);
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: unknown } } };
            const detail = error?.response?.data?.detail;
            setCreateError(typeof detail === "string" ? detail : t('createError'));
        } finally {
            setCreating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm font-medium text-slate-500">{t('loadingTeams')}</p>
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
                        {t('manageTeamsDesc')}
                    </p>
                </div>
                {canCreate && (
                    <Button onClick={openModal}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t('addTeam')}
                    </Button>
                )}
            </div>

            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-700">
                    {error}
                </div>
            )}

            {teams.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-16 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <Users className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">{t('noTeams')}</h3>
                    <p className="mt-2 text-slate-500 max-w-xs mx-auto">
                        {t('noTeamsDesc')}
                    </p>
                    {canCreate && (
                        <Button onClick={openModal} className="mt-6">
                            <Plus className="h-4 w-4 mr-2" />
                            {t('addTeam')}
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {teams.map((team) => (
                        <Link
                            key={team.id}
                            href={`/dashboard/teams/${team.id}`}
                            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5"
                        >
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors mb-1">
                                    {team.name}
                                </h3>
                                {team.organization_name && (
                                    <p className="text-sm text-slate-500 line-clamp-1">{team.organization_name}</p>
                                )}
                            </div>
                            <div className="mt-8 flex items-center gap-2 text-sm text-slate-500">
                                <Users className="h-4 w-4" />
                                <span>{t('membersCount', { count: team.members_count ?? 0 })}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Create Team Modal */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Users className="h-5 w-5 text-blue-600" />
                            {t('createTeamTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('createTeamDesc')}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreate} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="team-name">{t('teamNameLabel')}</Label>
                            <Input
                                id="team-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                minLength={1}
                                maxLength={255}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="team-org">{t('orgLabel')}</Label>
                            <select
                                id="team-org"
                                className="bg-white border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                value={organizationId}
                                onChange={(e) => setOrganizationId(e.target.value)}
                                required
                            >
                                <option value="">{t('selectOrg')}</option>
                                {orgs.map((org) => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                            </select>
                        </div>

                        {createError && (
                            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                                {createError}
                            </div>
                        )}

                        <DialogFooter className="pt-2">
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={creating}>{tCommon('cancel')}</Button>
                            </DialogClose>
                            <Button type="submit" disabled={creating}>
                                {creating ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('creating')}</>
                                ) : (
                                    <><Save className="h-4 w-4 mr-2" />{t('createTeam')}</>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
