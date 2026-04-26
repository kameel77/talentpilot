"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type Team } from "@/lib/api";
import { Building, Users, MapPin, FileText, Calendar, ArrowLeft, Plus } from "lucide-react";
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
    created_at: string;
}

export default function OrganizationDetailsPage() {
    const params = useParams();
    const id = Number(params.id);

    const [org, setOrg] = useState<Organization | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // New team dialog state
    const [showNewTeam, setShowNewTeam] = useState(false);
    const [newTeamName, setNewTeamName] = useState("");
    const [newTeamDesc, setNewTeamDesc] = useState("");
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [orgData, allTeams] = await Promise.all([
                    api.organizations.get(id),
                    api.teams.list(),
                ]);
                setOrg(orgData as Organization);
                
                // Filter teams by this organization
                const orgTeams = allTeams.filter(t => t.organization_id === id);
                setTeams(orgTeams);
            } catch (err) {
                console.error(err);
                setError("Nie udało się pobrać szczegółów organizacji.");
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

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm font-medium text-slate-500">Pobieranie szczegółów…</p>
                </div>
            </div>
        );
    }

    if (error || !org) {
        return (
            <div className="space-y-6">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-700">
                    {error || "Organizacja nie istnieje."}
                </div>
                <Link href="/dashboard/organizations" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Powrót do listy
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
                    Organizacje
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
                            <div className="mt-2 flex items-center gap-4 text-sm text-slate-500">
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
                                    Utworzono: {new Date(org.created_at).toLocaleDateString("pl-PL")}
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
                        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-slate-400" />
                            Dane firmy
                        </h2>
                        
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Nazwa</p>
                                <p className="text-base text-slate-900">{org.name}</p>
                            </div>
                            
                            {org.tax_id && (
                                <div>
                                    <p className="text-sm font-medium text-slate-500">NIP</p>
                                    <p className="text-base text-slate-900">{org.tax_id}</p>
                                </div>
                            )}

                            {(org.street || org.postal_code || org.city) && (
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Adres</p>
                                    <p className="text-base text-slate-900">
                                        {org.street && <span className="block">{org.street}</span>}
                                        {org.postal_code && <span>{org.postal_code} </span>}
                                        {org.city && <span>{org.city}</span>}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right column: Teams */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Users className="h-6 w-6 text-blue-600" />
                            Zespoły w organizacji
                        </h2>
                        {teams.length > 0 && (
                            <Button size="sm" className="gap-1.5" onClick={() => setShowNewTeam(true)}>
                                <Plus className="h-4 w-4" />
                                Dodaj zespół
                            </Button>
                        )}
                    </div>

                    {teams.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
                            <Users className="mx-auto h-8 w-8 text-slate-400 mb-3" />
                            <h3 className="text-sm font-medium text-slate-900">Brak zespołów</h3>
                            <p className="mt-1 text-sm text-slate-500">
                                W tej organizacji nie ma jeszcze żadnych zespołów. Dodaj pierwszy zespół.
                            </p>
                            <div className="mt-4">
                                <Button size="sm" className="gap-1.5" onClick={() => setShowNewTeam(true)}>
                                    <Plus className="h-4 w-4" />
                                    Dodaj zespół
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
                                        {team.members_count} członków
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Team Dialog — rendered once */}
            <Dialog open={showNewTeam} onOpenChange={setShowNewTeam}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nowy zespół</DialogTitle>
                        <DialogDescription>
                            Utwórz nowy zespół w organizacji <strong>{org.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="team-name">Nazwa zespołu *</Label>
                            <Input
                                id="team-name"
                                placeholder="np. Zespół Sprzedaży"
                                value={newTeamName}
                                onChange={e => setNewTeamName(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleCreateTeam()}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="team-desc">Opis (opcjonalnie)</Label>
                            <Input
                                id="team-desc"
                                placeholder="Krótki opis zespołu"
                                value={newTeamDesc}
                                onChange={e => setNewTeamDesc(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setShowNewTeam(false)}>
                                Anuluj
                            </Button>
                            <Button onClick={handleCreateTeam} disabled={!newTeamName.trim() || creating}>
                                {creating ? "Tworzenie…" : "Utwórz zespół"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

