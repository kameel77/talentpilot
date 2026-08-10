"use client";

import { useCallback, useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { UnsavedBar } from "@/components/settings/UnsavedBar";
import { useToast } from "@/components/ui/toast";
import { useFormState } from "@/hooks/useFormState";
import { api, tokenManager, type Organization } from "@/lib/api";
import { cn } from "@/lib/utils";

interface InvoiceForm {
    name: string;
    street: string;
    postalCode: string;
    city: string;
    taxId: string;
}

const EMPTY_INVOICE: InvoiceForm = { name: "", street: "", postalCode: "", city: "", taxId: "" };

const PLAN_LABEL: Record<string, string> = { free: "Free", pro: "Pro", studio: "Studio" };

const STATUS_LABEL: Record<string, string> = {
    trialing: "Okres testowy",
    active: "Aktywna",
    past_due: "Zaległa płatność",
    canceled: "Anulowana",
    free: "Bez subskrypcji",
};

const STATUS_STYLE: Record<string, string> = {
    trialing: "bg-blue-50 text-blue-700 border-blue-200",
    active: "bg-green-50 text-green-700 border-green-200",
    past_due: "bg-amber-50 text-amber-800 border-amber-200",
    canceled: "bg-slate-100 text-slate-600 border-slate-200",
    free: "bg-slate-100 text-slate-600 border-slate-200",
};

function formatDate(value: string): string {
    return new Date(value).toLocaleDateString("pl-PL", { day: "2-digit", month: "long", year: "numeric" });
}

function daysLeft(value: string): number {
    return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
}

export default function BillingSettingsPage() {
    const { toast } = useToast();
    const [org, setOrg] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { values, setField, isDirty, hydrate, commit, reset } = useFormState<InvoiceForm>(EMPTY_INVOICE);

    const hydrateFromOrg = useCallback(
        (o: Organization) => {
            setOrg(o);
            hydrate({
                name: o.name ?? "",
                street: o.street ?? "",
                postalCode: o.postal_code ?? "",
                city: o.city ?? "",
                taxId: o.tax_id ?? "",
            });
        },
        [hydrate]
    );

    useEffect(() => {
        const user = tokenManager.getUser();
        if (!user) return;
        const orgId = tokenManager.getActiveOrgId() ?? user.organization_id;
        api.organizations
            .get(orgId)
            .then(hydrateFromOrg)
            .catch(() => toast("Nie udało się wczytać danych rozliczeniowych.", "error"))
            .finally(() => setLoading(false));
    }, [hydrateFromOrg, toast]);

    const handleSave = async () => {
        if (!org) return;
        setSaving(true);
        try {
            const updated = await api.organizations.update(org.id, {
                name: values.name || undefined,
                street: values.street || undefined,
                postal_code: values.postalCode || undefined,
                city: values.city || undefined,
                tax_id: values.taxId || undefined,
            });
            setOrg(updated);
            commit();
            toast("Dane do faktury zostały zapisane.");
        } catch {
            toast("Błąd zapisu. Sprawdź uprawnienia.", "error");
        } finally {
            setSaving(false);
        }
    };

    const plan = org?.plan ?? "free";
    const status = org?.subscription_status ?? "free";
    const trialEndsAt = org?.trial_ends_at ?? null;

    return (
        <div className="space-y-6">
            <SettingsCard
                title="Twój plan"
                description="Bieżąca subskrypcja workspace'u"
                aside={
                    !loading && (
                        <span
                            className={cn(
                                "rounded-full border px-3 py-1 text-xs font-semibold",
                                STATUS_STYLE[status] ?? STATUS_STYLE.free
                            )}
                        >
                            {STATUS_LABEL[status] ?? STATUS_LABEL.free}
                        </span>
                    )
                }
            >
                {loading ? (
                    <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-semibold text-slate-900">{PLAN_LABEL[plan] ?? "Free"}</span>
                            {status === "trialing" && trialEndsAt && (
                                <span className="text-sm text-muted-foreground">
                                    do {formatDate(trialEndsAt)} · zostało {daysLeft(trialEndsAt)} dni
                                </span>
                            )}
                        </div>

                        {status === "past_due" && (
                            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                Ostatnia płatność się nie powiodła. Zaktualizuj metodę płatności, aby uniknąć obniżenia planu.
                            </p>
                        )}

                        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                            <div className="text-sm text-slate-600">
                                <p className="font-medium text-slate-700">Płatności kartą i faktury — wkrótce</p>
                                <p className="mt-0.5">
                                    Zmiana planu, metoda płatności i historia faktur pojawią się tutaj po uruchomieniu
                                    płatności. Do tego czasu plan zmienia administrator.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </SettingsCard>

            <SettingsCard
                title="Dane do faktury"
                description="Nabywca na fakturach VAT — uzupełnij przed pierwszą płatnością"
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="invoice-name">Nazwa nabywcy</Label>
                        <Input
                            id="invoice-name"
                            value={values.name}
                            onChange={(e) => setField("name", e.target.value)}
                            placeholder="Nazwa firmy"
                        />
                        <p className="text-xs text-muted-foreground">
                            To ta sama nazwa co w zakładce „Moja organizacja”.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="invoice-street">Ulica i numer</Label>
                        <Input
                            id="invoice-street"
                            value={values.street}
                            onChange={(e) => setField("street", e.target.value)}
                            placeholder="ul. Przykładowa 1"
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="invoice-postal">Kod pocztowy</Label>
                            <Input
                                id="invoice-postal"
                                value={values.postalCode}
                                onChange={(e) => setField("postalCode", e.target.value)}
                                placeholder="00-000"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="invoice-city">Miasto</Label>
                            <Input
                                id="invoice-city"
                                value={values.city}
                                onChange={(e) => setField("city", e.target.value)}
                                placeholder="Warszawa"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="invoice-nip">NIP</Label>
                        <Input
                            id="invoice-nip"
                            value={values.taxId}
                            onChange={(e) => setField("taxId", e.target.value)}
                            placeholder="0000000000"
                            className="sm:max-w-xs"
                        />
                        <p className="text-xs text-muted-foreground">
                            Wymagany do wystawienia faktury VAT i wysyłki do KSeF.
                        </p>
                    </div>
                </div>
            </SettingsCard>

            <UnsavedBar visible={isDirty} saving={saving} onSave={handleSave} onReset={reset} />
        </div>
    );
}
