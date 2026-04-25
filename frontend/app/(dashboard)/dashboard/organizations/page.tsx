"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Building, Plus, Loader2, Save } from "lucide-react";
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

interface Organization {
    id: number;
    name: string;
    street: string | null;
    postal_code: string | null;
    city: string | null;
    tax_id: string | null;
    created_at: string;
}

export default function OrganizationsPage() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Create-org modal
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [street, setStreet] = useState("");
    const [postalCode, setPostalCode] = useState("");
    const [city, setCity] = useState("");
    const [taxId, setTaxId] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        try {
            setLoading(true);
            const orgsData = await api.organizations.list();
            setOrganizations(orgsData as Organization[]);
        } catch {
            setError("Nie udało się pobrać organizacji.");
        } finally {
            setLoading(false);
        }
    };

    const openModal = () => {
        setName("");
        setStreet("");
        setPostalCode("");
        setCity("");
        setTaxId("");
        setCreateError(null);
        setOpen(true);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError(null);

        try {
            setCreating(true);
            const created = await api.organizations.create({
                name: name.trim(),
                street: street.trim() || undefined,
                postal_code: postalCode.trim() || undefined,
                city: city.trim() || undefined,
                tax_id: taxId.trim() || undefined,
            });
            setOrganizations([created as Organization, ...organizations]);
            setOpen(false);
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: unknown } } };
            const detail = error?.response?.data?.detail;
            setCreateError(typeof detail === "string" ? detail : "Nie udało się utworzyć organizacji.");
        } finally {
            setCreating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm font-medium text-slate-500">Pobieranie organizacji…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">Organizacje</h1>
                    <p className="mt-2 text-slate-500 max-w-2xl">
                        Zarządzaj organizacjami, w ramach których działają zespoły.
                    </p>
                </div>
                <Button onClick={openModal}>
                    <Plus className="h-4 w-4 mr-2" />
                    Dodaj organizację
                </Button>
            </div>

            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-700">
                    {error}
                </div>
            )}

            {organizations.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-16 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <Building className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Brak organizacji</h3>
                    <p className="mt-2 text-slate-500 max-w-xs mx-auto">
                        Nie masz jeszcze dostępu do żadnych organizacji. Stwórz swoją pierwszą organizację.
                    </p>
                    <Button onClick={openModal} className="mt-6">
                        <Plus className="h-4 w-4 mr-2" />
                        Dodaj organizację
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {organizations.map((org) => (
                        <Link
                            key={org.id}
                            href={`/dashboard/organizations/${org.id}`}
                            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5"
                        >
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors mb-1">
                                    {org.name}
                                </h3>
                                {org.city && (
                                    <p className="text-sm text-slate-500 line-clamp-1">{org.city}</p>
                                )}
                            </div>
                            <div className="mt-8 flex items-center gap-2 text-sm text-slate-500">
                                <Building className="h-4 w-4" />
                                <span>{org.tax_id ? `NIP: ${org.tax_id}` : "Brak NIP"}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Create Organization Modal */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Building className="h-5 w-5 text-blue-600" />
                            Dodaj organizację
                        </DialogTitle>
                        <DialogDescription>
                            Podaj dane nowej organizacji. Tylko nazwa jest polem obowiązkowym.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreate} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="org-name">Nazwa organizacji *</Label>
                            <Input
                                id="org-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                minLength={1}
                                maxLength={255}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="org-tax">NIP (opcjonalnie)</Label>
                            <Input
                                id="org-tax"
                                value={taxId}
                                onChange={(e) => setTaxId(e.target.value)}
                                maxLength={255}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="org-city">Miasto (opcjonalnie)</Label>
                            <Input
                                id="org-city"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                maxLength={255}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="org-street">Ulica i numer (opcjonalnie)</Label>
                            <Input
                                id="org-street"
                                value={street}
                                onChange={(e) => setStreet(e.target.value)}
                                maxLength={255}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="org-postal">Kod pocztowy (opcjonalnie)</Label>
                            <Input
                                id="org-postal"
                                value={postalCode}
                                onChange={(e) => setPostalCode(e.target.value)}
                                maxLength={20}
                            />
                        </div>

                        {createError && (
                            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                                {createError}
                            </div>
                        )}

                        <DialogFooter className="pt-2">
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={creating}>Anuluj</Button>
                            </DialogClose>
                            <Button type="submit" disabled={creating}>
                                {creating ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Tworzenie…</>
                                ) : (
                                    <><Save className="h-4 w-4 mr-2" />Utwórz organizację</>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
