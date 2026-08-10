"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { UnsavedBar } from "@/components/settings/UnsavedBar";
import { useToast } from "@/components/ui/toast";
import { useFormState } from "@/hooks/useFormState";
import { api, tokenManager, type Organization, type User as UserType } from "@/lib/api";

interface OrgForm {
    name: string;
    street: string;
    postalCode: string;
    city: string;
}

const EMPTY_ORG: OrgForm = { name: "", street: "", postalCode: "", city: "" };

const ROLE_ROWS: Array<{ role: UserType["role"]; label: string; desc: string }> = [
    { role: "admin", label: "Administratorzy", desc: "Pełny dostęp" },
    { role: "manager", label: "Menedżerowie", desc: "Zarządzanie zespołem" },
    { role: "coach", label: "Coachowie", desc: "Dostęp do organizacji klientów" },
    { role: "user", label: "Użytkownicy", desc: "Podstawowy dostęp" },
];

function peopleLabel(count: number): string {
    if (count === 1) return "1 osoba";
    if (count % 10 >= 2 && count % 10 <= 4 && !(count % 100 >= 12 && count % 100 <= 14)) return `${count} osoby`;
    return `${count} osób`;
}

export default function OrganizationSettingsPage() {
    const { toast } = useToast();
    const [currentUser, setCurrentUser] = useState<UserType | null>(null);
    const [org, setOrg] = useState<Organization | null>(null);
    const [saving, setSaving] = useState(false);
    const [roleCounts, setRoleCounts] = useState<Record<string, number> | null>(null);
    const { values, setField, isDirty, hydrate, commit, reset } = useFormState<OrgForm>(EMPTY_ORG);

    const [createOpen, setCreateOpen] = useState(false);
    const [newOrg, setNewOrg] = useState({ name: "", street: "", postal: "", city: "", taxId: "" });
    const [newOrgSaving, setNewOrgSaving] = useState(false);
    const [newOrgError, setNewOrgError] = useState<string | null>(null);

    const hydrateFromOrg = useCallback(
        (o: Organization) => {
            setOrg(o);
            hydrate({
                name: o.name ?? "",
                street: o.street ?? "",
                postalCode: o.postal_code ?? "",
                city: o.city ?? "",
            });
        },
        [hydrate]
    );

    useEffect(() => {
        const user = tokenManager.getUser();
        if (!user) return;
        setCurrentUser(user);
        const orgId = tokenManager.getActiveOrgId() ?? user.organization_id;

        api.organizations.get(orgId).then(hydrateFromOrg).catch(() => undefined);

        api.users
            .list(undefined, orgId)
            .then((members: UserType[]) => {
                const counts: Record<string, number> = {};
                members.forEach((m) => {
                    counts[m.role] = (counts[m.role] ?? 0) + 1;
                });
                setRoleCounts(counts);
            })
            .catch(() => setRoleCounts(null));
    }, [hydrateFromOrg]);

    const canEdit =
        currentUser?.role === "admin" || currentUser?.role === "manager" || currentUser?.role === "coach";
    const canCreate = currentUser?.role === "admin" || currentUser?.role === "coach";
    const canSeeBilling = canEdit;

    const handleSave = async () => {
        if (!org) return;
        setSaving(true);
        try {
            const updated = await api.organizations.update(org.id, {
                name: values.name || undefined,
                street: values.street || undefined,
                postal_code: values.postalCode || undefined,
                city: values.city || undefined,
            });
            setOrg(updated);
            commit();
            toast("Dane organizacji zostały zapisane.");
        } catch {
            toast("Błąd zapisu. Sprawdź uprawnienia.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setNewOrgError(null);
        setNewOrgSaving(true);
        try {
            await api.organizations.create({
                name: newOrg.name.trim(),
                street: newOrg.street.trim() || undefined,
                postal_code: newOrg.postal.trim() || undefined,
                city: newOrg.city.trim() || undefined,
                tax_id: newOrg.taxId.trim() || undefined,
            });
            setCreateOpen(false);
            setNewOrg({ name: "", street: "", postal: "", city: "", taxId: "" });
            toast("Organizacja została utworzona.");
        } catch (err) {
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            setNewOrgError(typeof detail === "string" ? detail : "Nie udało się utworzyć organizacji.");
        } finally {
            setNewOrgSaving(false);
        }
    };

    /* Members without edit rights get a readable summary, not a disabled form. */
    if (!canEdit) {
        return (
            <SettingsCard title="Organizacja" description="Dane Twojej organizacji">
                <dl className="divide-y divide-slate-100">
                    {[
                        ["Nazwa", org?.name],
                        ["Ulica i numer", org?.street],
                        ["Kod pocztowy", org?.postal_code],
                        ["Miasto", org?.city],
                    ].map(([label, value]) => (
                        <div key={label as string} className="flex items-baseline justify-between gap-4 py-2.5">
                            <dt className="text-sm text-muted-foreground">{label}</dt>
                            <dd className="text-right text-sm font-medium text-slate-900">{value || "—"}</dd>
                        </div>
                    ))}
                </dl>
                <p className="mt-4 text-sm text-muted-foreground">
                    Dane organizacji zmienia administrator lub menedżer.
                </p>
            </SettingsCard>
        );
    }

    return (
        <div className="space-y-6">
            <SettingsCard title="Dane organizacji" description="Nazwa i adres widoczne w aplikacji">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="org-name">Nazwa organizacji</Label>
                        <Input
                            id="org-name"
                            value={values.name}
                            onChange={(e) => setField("name", e.target.value)}
                            placeholder="Nazwa firmy"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="org-street">Ulica i numer</Label>
                        <Input
                            id="org-street"
                            value={values.street}
                            onChange={(e) => setField("street", e.target.value)}
                            placeholder="ul. Przykładowa 1"
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="org-postal">Kod pocztowy</Label>
                            <Input
                                id="org-postal"
                                value={values.postalCode}
                                onChange={(e) => setField("postalCode", e.target.value)}
                                placeholder="00-000"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="org-city">Miasto</Label>
                            <Input
                                id="org-city"
                                value={values.city}
                                onChange={(e) => setField("city", e.target.value)}
                                placeholder="Warszawa"
                            />
                        </div>
                    </div>
                    {canSeeBilling && (
                        <p className="text-xs text-muted-foreground">
                            NIP i dane nabywcy na fakturze znajdziesz w{" "}
                            <Link href="/dashboard/settings/billing" className="text-primary hover:underline">
                                Rozliczeniach
                            </Link>
                            .
                        </p>
                    )}
                </div>
            </SettingsCard>

            <SettingsCard
                title="Użytkownicy i role"
                description="Kto ma dostęp do tej organizacji"
                aside={
                    <Link
                        href="/dashboard/users"
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                        Zarządzaj
                        <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                }
            >
                {roleCounts === null ? (
                    <p className="text-sm text-muted-foreground">Nie udało się wczytać listy użytkowników.</p>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {ROLE_ROWS.filter(({ role }) => (roleCounts[role] ?? 0) > 0).map(({ role, label, desc }) => (
                            <div key={role} className="flex items-center justify-between py-2.5">
                                <div>
                                    <p className="text-sm font-medium text-slate-900">{label}</p>
                                    <p className="text-xs text-muted-foreground">{desc}</p>
                                </div>
                                <span className="text-sm text-muted-foreground">{peopleLabel(roleCounts[role])}</span>
                            </div>
                        ))}
                    </div>
                )}
            </SettingsCard>

            {canCreate && (
                <SettingsCard title="Nowa organizacja" description="Utwórz kolejną organizację w swoim koncie">
                    <Button variant="outline" onClick={() => setCreateOpen(true)}>
                        <Building2 className="mr-2 h-4 w-4" />
                        Dodaj nową organizację
                    </Button>
                </SettingsCard>
            )}

            <UnsavedBar visible={isDirty} saving={saving} onSave={handleSave} onReset={reset} />

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Building2 className="h-5 w-5 text-blue-600" />
                            Dodaj organizację
                        </DialogTitle>
                        <DialogDescription>Pola adresowe i NIP są opcjonalne.</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreate} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="new-org-name">Nazwa organizacji</Label>
                            <Input
                                id="new-org-name"
                                value={newOrg.name}
                                onChange={(e) => setNewOrg((s) => ({ ...s, name: e.target.value }))}
                                required
                                minLength={1}
                                maxLength={255}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-org-street">Ulica i numer</Label>
                            <Input
                                id="new-org-street"
                                value={newOrg.street}
                                onChange={(e) => setNewOrg((s) => ({ ...s, street: e.target.value }))}
                                maxLength={255}
                                placeholder="ul. Przykładowa 1"
                            />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="new-org-postal">Kod pocztowy</Label>
                                <Input
                                    id="new-org-postal"
                                    value={newOrg.postal}
                                    onChange={(e) => setNewOrg((s) => ({ ...s, postal: e.target.value }))}
                                    maxLength={20}
                                    placeholder="00-000"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-org-city">Miasto</Label>
                                <Input
                                    id="new-org-city"
                                    value={newOrg.city}
                                    onChange={(e) => setNewOrg((s) => ({ ...s, city: e.target.value }))}
                                    maxLength={120}
                                    placeholder="Warszawa"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-org-nip">NIP</Label>
                            <Input
                                id="new-org-nip"
                                value={newOrg.taxId}
                                onChange={(e) => setNewOrg((s) => ({ ...s, taxId: e.target.value }))}
                                maxLength={32}
                                placeholder="0000000000"
                            />
                        </div>
                        {newOrgError && <p className="text-sm text-destructive">{newOrgError}</p>}
                        <DialogFooter className="pt-2">
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={newOrgSaving}>
                                    Anuluj
                                </Button>
                            </DialogClose>
                            <Button type="submit" variant="hero" disabled={newOrgSaving}>
                                <Save className="mr-2 h-4 w-4" />
                                {newOrgSaving ? "Tworzenie…" : "Utwórz organizację"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
