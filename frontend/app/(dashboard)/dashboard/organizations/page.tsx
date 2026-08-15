"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Building, Plus, Loader2, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import IndividualClientsTab from "@/components/clients/IndividualClientsTab";
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

import { useRoleLabels } from "@/hooks/useRoleLabels";
import { getApiErrorMessage } from "@/lib/utils";

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
    return (
        <Suspense fallback={null}>
            <OrganizationsPageContent />
        </Suspense>
    );
}

function OrganizationsPageContent() {
    const t = useTranslations('organizations');
    const tClients = useTranslations('clients');
    const { isCoach, orgsLabel } = useRoleLabels();
    // Deep link from the dashboard card: /dashboard/organizations?tab=individuals
    const initialTab = useSearchParams().get("tab") === "individuals" ? "individuals" : "orgs";
    const [activeTab, setActiveTab] = useState<"orgs" | "individuals">(initialTab);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    const query = search.trim().toLowerCase();
    const filteredOrganizations = query
        ? organizations.filter((org) =>
            [org.name, org.city, org.tax_id]
                .filter(Boolean)
                .some((field) => (field as string).toLowerCase().includes(query))
        )
        : organizations;

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
            setError(t('fetchError'));
        } finally {
            setLoading(false);
        }
    };

    const openModal = async () => {
        const canAdd = await api.billing.checkLimit('client_orgs');
        if (!canAdd) return;
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
            setCreateError(getApiErrorMessage(err, t('createError')));
        } finally {
            setCreating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm font-medium text-slate-500">{t('loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">{orgsLabel}</h1>
                    <p className="mt-2 text-slate-500 max-w-2xl">
                        {t('subtitle')}
                    </p>
                </div>
                <Button onClick={openModal}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('create')}
                </Button>
            </div>

            {isCoach && (
                <div className="flex gap-2 border-b border-slate-200 mb-6">
                    {(["orgs", "individuals"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={
                                activeTab === tab
                                    ? "px-4 py-2 text-sm font-semibold text-primary border-b-2 border-primary"
                                    : "px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
                            }
                        >
                            {tab === "orgs" ? tClients("tabOrgs") : tClients("tabIndividuals")}
                        </button>
                    ))}
                </div>
            )}

            {/* Search — filters both tabs */}
            <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={
                        !isCoach || activeTab === "orgs"
                            ? t("searchPlaceholder")
                            : tClients("searchPlaceholder")
                    }
                    className="pl-10 rounded-xl"
                />
            </div>

            {(!isCoach || activeTab === "orgs") && (
                <>
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
                            <h3 className="text-lg font-semibold text-slate-900">{t('noOrgs')}</h3>
                            <p className="mt-2 text-slate-500 max-w-xs mx-auto">
                                {t('noOrgsMessage')}
                            </p>
                            <Button onClick={openModal} className="mt-6">
                                <Plus className="h-4 w-4 mr-2" />
                                {t('create')}
                            </Button>
                        </div>
                    ) : filteredOrganizations.length === 0 ? (
                        <p className="text-slate-500 text-sm py-8 text-center">{t("noResults")}</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredOrganizations.map((org) => (
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
                </>
            )}

            {isCoach && activeTab === "individuals" && <IndividualClientsTab filter={search} />}

            {/* Create Organization Modal */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Building className="h-5 w-5 text-blue-600" />
                            {t('addOrgTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('addOrgDesc')}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreate} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="org-name">{t('orgNameLabel')}</Label>
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
                            <Label htmlFor="org-tax">{t('orgTaxLabel')}</Label>
                            <Input
                                id="org-tax"
                                value={taxId}
                                onChange={(e) => setTaxId(e.target.value)}
                                maxLength={255}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="org-city">{t('orgCityLabel')}</Label>
                            <Input
                                id="org-city"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                maxLength={255}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="org-street">{t('orgStreetLabel')}</Label>
                            <Input
                                id="org-street"
                                value={street}
                                onChange={(e) => setStreet(e.target.value)}
                                maxLength={255}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="org-postal">{t('orgPostalLabel')}</Label>
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
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('creating')}</>
                                ) : (
                                    <><Save className="h-4 w-4 mr-2" />{t('createOrg')}</>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
