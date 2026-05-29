"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { api, type Team } from "@/lib/api";
import { Building, Users, MapPin, FileText, Calendar, ArrowLeft, Plus, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Organization {
    id: number;
    name: string;
    street: string | null;
    postal_code: string | null;
    city: string | null;
    tax_id: string | null;
    language: string;
    created_at: string;
}

export default function OrganizationDetailsPage() {
    const t = useTranslations('organizations');
    const tInv = useTranslations('invitations');
    const params = useParams();
    const id = Number(params.id);

    const [org, setOrg] = useState<Organization | null>(null);
    const [orgLang, setOrgLang] = useState<'pl' | 'en'>('pl');
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // New team dialog state
    const [showNewTeam, setShowNewTeam] = useState(false);
    const [newTeamName, setNewTeamName] = useState("");
    const [newTeamDesc, setNewTeamDesc] = useState("");
    const [creating, setCreating] = useState(false);

    // Edit organization dialog state
    const [showEditOrg, setShowEditOrg] = useState(false);
    const [editName, setEditName] = useState("");
    const [editStreet, setEditStreet] = useState("");
    const [editPostalCode, setEditPostalCode] = useState("");
    const [editCity, setEditCity] = useState("");
    const [editTaxId, setEditTaxId] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [orgData, allTeams] = await Promise.all([
                    api.organizations.get(id),
                    api.teams.list(),
                ]);
                setOrg(orgData as Organization);
                setOrgLang(((orgData as Organization).language ?? 'pl') as 'pl' | 'en');

                // Filter teams by this organization
                const orgTeams = allTeams.filter(t => t.organization_id === id);
                setTeams(orgTeams);
            } catch (err) {
                console.error(err);
                setError(t('fetchDetailsError'));
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            loadData();
        }
    }, [id]);

    const handleCreateTeam = async () => {
        if (!newTeamName.trim()) return;
        try {
            setCreating(true);
            const team = await api.teams.create({
                name: newTeamName.trim(),
                description: newTeamDesc.trim() || undefined,
                organization_id: id,
            });
            setTeams(prev => [...prev, team]);
            setNewTeamName("");
            setNewTeamDesc("");
            setShowNewTeam(false);
        } catch (err) {
            console.error("Failed to create team:", err);
        } finally {
            setCreating(false);
        }
    };

    const openEditDialog = () => {
        if (!org) return;
        setEditName(org.name);
        setEditStreet(org.street || "");
        setEditPostalCode(org.postal_code || "");
        setEditCity(org.city || "");
        setEditTaxId(org.tax_id || "");
        setSaveSuccess(false);
        setShowEditOrg(true);
    };

    const handleOrgLangChange = async (lang: 'pl' | 'en') => {
        try {
            const updated = await api.organizations.update(id, { language: lang });
            setOrg(updated as Organization);
            setOrgLang(lang);
        } catch (err) {
            console.error("Failed to update org language:", err);
        }
    };

    const handleSaveOrg = async () => {
        if (!editName.trim()) return;
        try {
            setSaving(true);
            const updated = await api.organizations.update(id, {
                name: editName.trim(),
                street: editStreet.trim() || undefined,
                postal_code: editPostalCode.trim() || undefined,
                city: editCity.trim() || undefined,
                tax_id: editTaxId.trim() || undefined,
            });
            setOrg(updated as Organization);
            setSaveSuccess(true);
            setTimeout(() => {
                setShowEditOrg(false);
                setSaveSuccess(false);
            }, 800);
        } catch (err) {
            console.error("Failed to update organization:", err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm font-medium text-slate-500">{t('loadingDetails')}</p>
                </div>
            </div>
        );
    }

    if (error || !org) {
        return (
            <div className="space-y-6">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-700">
                    {error || t('notFound')}
                </div>
                <Link href="/dashboard/organizations" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t('backToList')}
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            {/* Header Section */}
            <div>
                <Link 
                    href="/dashboard/organizations" 
                    className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 transition-colors"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t('title')}
                </Link>
                
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                            <Building className="h-8 w-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">
                                {org.name}
                            </h1>
                            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                {org.city && (
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="h-4 w-4" />
                                        {org.city}
                                    </div>
                                )}
                                {org.tax_id && (
                                    <div className="flex items-center gap-1.5">
                                        <FileText className="h-4 w-4" />
                                        NIP: {org.tax_id}
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="h-4 w-4" />
                                    {t('createdAt')} {new Date(org.created_at).toLocaleDateString("pl-PL")}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left column: Organization Details */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <FileText className="h-5 w-5 text-slate-400" />
                                {t('companyData')}
                            </h2>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-slate-500 hover:text-slate-900"
                                onClick={openEditDialog}
                            >
                                <Pencil className="h-3.5 w-3.5" />
                                {t('editCompany')}
                            </Button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-slate-500">{t('fieldName')}</p>
                                <p className="text-base text-slate-900">{org.name}</p>
                            </div>

                            <div>
                                <p className="text-sm font-medium text-slate-500">{t('fieldTaxId')}</p>
                                <p className="text-base text-slate-900">
                                    {org.tax_id || <span className="text-slate-400 italic">{t('fieldNotProvided')}</span>}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm font-medium text-slate-500">{t('fieldAddress')}</p>
                                {(org.street || org.postal_code || org.city) ? (
                                    <p className="text-base text-slate-900">
                                        {org.street && <span className="block">{org.street}</span>}
                                        {(org.postal_code || org.city) && (
                                            <span>{org.postal_code} {org.city}</span>
                                        )}
                                    </p>
                                ) : (
                                    <p className="text-base text-slate-400 italic">{t('fieldNotProvided')}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Invitation Language */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <h3 className="text-sm font-semibold text-slate-900 mb-1">{tInv('orgLanguage.title')}</h3>
                        <p className="text-sm text-slate-500 mb-4">{tInv('orgLanguage.description')}</p>
                        <div className="flex gap-2">
                            <Button
                                variant={orgLang === 'pl' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleOrgLangChange('pl')}
                            >
                                Polski
                            </Button>
                            <Button
                                variant={orgLang === 'en' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleOrgLangChange('en')}
                            >
                                English
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Right column: Teams */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Users className="h-6 w-6 text-blue-600" />
                            {t('teamsInOrg')}
                        </h2>
                        {teams.length > 0 && (
                            <Button size="sm" className="gap-1.5" onClick={() => setShowNewTeam(true)}>
                                <Plus className="h-4 w-4" />
                                {t('addTeam')}
                            </Button>
                        )}
                    </div>

                    {teams.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
                            <Users className="mx-auto h-8 w-8 text-slate-400 mb-3" />
                            <h3 className="text-sm font-medium text-slate-900">{t('noTeams')}</h3>
                            <p className="mt-1 text-sm text-slate-500">
                                {t('noTeamsDesc')}
                            </p>
                            <div className="mt-4">
                                <Button size="sm" className="gap-1.5" onClick={() => setShowNewTeam(true)}>
                                    <Plus className="h-4 w-4" />
                                    {t('addTeam')}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {teams.map(team => (
                                <Link 
                                    key={team.id}
                                    href={`/dashboard/teams/${team.id}`}
                                    className="block p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group"
                                >
                                    <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                        {team.name}
                                    </h3>
                                    {team.description && (
                                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                                            {team.description}
                                        </p>
                                    )}
                                    <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5 w-fit border border-slate-100">
                                        <Users className="h-3.5 w-3.5" />
                                        {team.members_count} {t('members')}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Team Dialog */}
            <Dialog open={showNewTeam} onOpenChange={setShowNewTeam}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('newTeamTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('newTeamDesc')} <strong>{org.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="team-name">{t('teamNameLabel')}</Label>
                            <Input
                                id="team-name"
                                placeholder={t('teamNamePlaceholder')}
                                value={newTeamName}
                                onChange={e => setNewTeamName(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleCreateTeam()}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="team-desc">{t('teamDescLabel')}</Label>
                            <Input
                                id="team-desc"
                                placeholder={t('teamDescPlaceholder')}
                                value={newTeamDesc}
                                onChange={e => setNewTeamDesc(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setShowNewTeam(false)}>
                                Anuluj
                            </Button>
                            <Button onClick={handleCreateTeam} disabled={!newTeamName.trim() || creating}>
                                {creating ? t('teamCreating') : t('createTeam')}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Organization Dialog */}
            <Dialog open={showEditOrg} onOpenChange={setShowEditOrg}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t('editOrgTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('editOrgDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">{t('editNameLabel')}</Label>
                            <Input
                                id="edit-name"
                                placeholder="Nazwa organizacji"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-tax-id">{t('editTaxLabel')}</Label>
                            <Input
                                id="edit-tax-id"
                                placeholder="np. 7017011122"
                                value={editTaxId}
                                onChange={e => setEditTaxId(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-street">{t('editStreetLabel')}</Label>
                            <Input
                                id="edit-street"
                                placeholder="np. ul. Główna 10"
                                value={editStreet}
                                onChange={e => setEditStreet(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="edit-postal">{t('editPostalLabel')}</Label>
                                <Input
                                    id="edit-postal"
                                    placeholder="00-000"
                                    value={editPostalCode}
                                    onChange={e => setEditPostalCode(e.target.value)}
                                />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <Label htmlFor="edit-city">{t('editCityLabel')}</Label>
                                <Input
                                    id="edit-city"
                                    placeholder="np. Warszawa"
                                    value={editCity}
                                    onChange={e => setEditCity(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setShowEditOrg(false)}>
                                Anuluj
                            </Button>
                            <Button
                                onClick={handleSaveOrg}
                                disabled={!editName.trim() || saving}
                                className={saveSuccess ? "bg-emerald-600 hover:bg-emerald-600" : ""}
                            >
                                {saveSuccess ? (
                                    <><Check className="h-4 w-4 mr-1.5" /> {t('saved')}</>
                                ) : saving ? (
                                    t('saving')
                                ) : (
                                    t('saveChanges')
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
