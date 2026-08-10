"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { UnsavedBar } from "@/components/settings/UnsavedBar";
import { PlanPicker } from "@/components/billing/PlanPicker";
import { useToast } from "@/components/ui/toast";
import { useFormState } from "@/hooks/useFormState";
import { api, tokenManager, type BillingStatus, type Organization } from "@/lib/api";
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
    const [billing, setBilling] = useState<BillingStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [portalPending, setPortalPending] = useState(false);
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
        Promise.all([
            api.organizations.get(orgId).then(hydrateFromOrg),
            api.billing.status().then(setBilling),
        ])
            .catch(() => toast("Nie udało się wczytać danych rozliczeniowych.", "error"))
            .finally(() => setLoading(false));
    }, [hydrateFromOrg, toast]);

    const openPortal = async () => {
        setPortalPending(true);
        try {
            const { url } = await api.billing.portal();
            window.location.assign(url);
        } catch {
            toast("Portal płatności jest chwilowo niedostępny.", "error");
            setPortalPending(false);
        }
    };

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

    const plan = billing?.plan ?? org?.plan ?? "free";
    const status = billing?.subscription_status ?? org?.subscription_status ?? "free";
    const trialEndsAt = billing?.trial_ends_at ?? org?.trial_ends_at ?? null;
    const trialDaysLeft = billing?.trial_days_left ?? 0;
    const hasPaymentMethod = Boolean(billing?.payment_method_last4);

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
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-semibold text-slate-900">{PLAN_LABEL[plan] ?? "Free"}</span>
                                {status === "trialing" && trialEndsAt && (
                                    <span className="text-sm text-muted-foreground">
                                        do {formatDate(trialEndsAt)} · zostało {trialDaysLeft || daysLeft(trialEndsAt)} dni
                                    </span>
                                )}
                            </div>
                            {billing?.enabled && hasPaymentMethod && (
                                <Button variant="outline" size="sm" onClick={openPortal} disabled={portalPending}>
                                    {portalPending ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <CreditCard className="mr-2 h-4 w-4" />
                                    )}
                                    Zarządzaj płatnością
                                </Button>
                            )}
                        </div>

                        {hasPaymentMethod && (
                            <p className="text-sm text-muted-foreground">
                                Karta kończąca się na {billing?.payment_method_last4}
                                {billing?.current_period_end
                                    ? ` · następne odnowienie ${formatDate(billing.current_period_end)}`
                                    : ""}
                            </p>
                        )}

                        {status === "past_due" && (
                            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                Ostatnia płatność się nie powiodła. Zaktualizuj metodę płatności, aby uniknąć obniżenia planu.
                            </p>
                        )}

                        {status === "free" && (
                            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                                Plan Free: organizacje klienckie są niedostępne, a liczba klientów indywidualnych
                                ograniczona do 3. Wybierz plan poniżej, aby zdjąć limity.
                            </p>
                        )}

                        {!billing?.enabled && (
                            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                <div className="text-sm text-slate-600">
                                    <p className="font-medium text-slate-700">Płatności nie są jeszcze włączone</p>
                                    <p className="mt-0.5">
                                        Okres testowy i limity planu działają, ale wybór planu i metoda płatności będą
                                        dostępne po skonfigurowaniu dostawcy płatności w tym środowisku.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </SettingsCard>

            {billing?.enabled && (
                <SettingsCard title="Plany" description="Rozliczenie miesięczne lub roczne — anulujesz w każdej chwili">
                    <PlanPicker status={billing} onError={(message) => toast(message, "error")} />
                </SettingsCard>
            )}

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
