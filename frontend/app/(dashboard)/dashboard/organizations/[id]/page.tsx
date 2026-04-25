"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Users, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Team {
    id: number;
    name: string;
    description?: string;
    members?: Record<string, unknown>[];
}

interface Org {
    id: number;
    name: string;
    address: string | null;
    nip: string | null;
    email: string | null;
    teams?: Team[];
}

export default function OrganizationDetailsPage() {
    const params = useParams();
    const orgId = parseInt(params.id as string);

    const [org, setOrg] = useState<Org | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: '', description: '' });
    const [submitLoading, setSubmitLoading] = useState(false);
    const [error, setError] = useState("");

    const fetchOrg = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.organizations.get(orgId);
            setOrg(data);
        } catch (err) {
            console.error(err);
            setError("Failed to load organization");
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => { fetchOrg(); }, [fetchOrg]);

    const handleAddTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        
        if (!form.name.trim()) {
            setError("Nazwa zespołu jest wymagana.");
            return;
        }

        try {
            setSubmitLoading(true);
            await api.teams.create({
                name: form.name,
                description: form.description,
                organization_id: orgId
            });
            setShowModal(false);
            setForm({ name: '', description: '' });
            fetchOrg(); // reload to get the new team
        } catch (err: unknown) {
            console.error(err);
            setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Nie udało się utworzyć zespołu");
        } finally {
            setSubmitLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm font-medium text-slate-500">Wczytywanie szczegółów organizacji...</p>
                </div>
            </div>
        );
    }

    if (!org) {
        return (
            <div className="text-center mt-12 text-slate-500">
                Nie znaleziono organizacji.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Link href="/dashboard/organizations" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Powrót do listy organizacji
            </Link>

            <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">{org.name}</h1>
                    <div className="mt-2 text-sm text-slate-500 space-y-1">
                        {org.address && <p>{org.address}</p>}
                        {org.nip && <p>NIP: {org.nip}</p>}
                    </div>
                </div>

                <Dialog open={showModal} onOpenChange={setShowModal}>
                    <DialogTrigger asChild>
                        <Button className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
                            <Plus className="h-4 w-4" />
                            Dodaj Zespół
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Nowy Zespół</DialogTitle>
                            <DialogDescription>
                                Utwórz nowy zespół w organizacji {org.name}.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddTeam} className="grid gap-4 mt-4">
                            <div className="grid gap-2">
                                <Label htmlFor="team-name">Nazwa zespołu *</Label>
                                <Input
                                    id="team-name"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    required
                                    placeholder="np. Sprzedaż B2B"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="team-desc">Opis zespołu (opcjonalnie)</Label>
                                <Input
                                    id="team-desc"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="np. Zespół odpowiedzialny za kluczowych klientów"
                                />
                            </div>
                            
                            {error && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                                    {error}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-4 border-t pt-4 border-slate-100">
                                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                                    Anuluj
                                </Button>
                                <Button type="submit" disabled={submitLoading}>
                                    {submitLoading ? "Tworzenie..." : "Utwórz zespół"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-slate-900">Zespoły w tej organizacji</h2>
                    <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                        <Users className="h-4 w-4" />
                        <span>{org.teams?.length || 0} Zespołów</span>
                    </div>
                </div>

                {!org.teams || org.teams.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        Brak zespołów w tej organizacji.
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {org.teams.map((team) => (
                            <Link
                                key={team.id}
                                href={`/dashboard/teams/${team.id}`}
                                className="group block rounded-xl border border-slate-200 bg-slate-50 p-5 hover:bg-white hover:border-blue-200 hover:shadow-md transition-all"
                            >
                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary mb-2">
                                    {team.name}
                                </h3>
                                <p className="text-sm text-slate-500 line-clamp-2">
                                    {team.description || "Brak opisu"}
                                </p>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
