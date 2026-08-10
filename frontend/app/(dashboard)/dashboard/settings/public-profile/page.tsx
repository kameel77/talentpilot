"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { ToggleRow } from "@/components/settings/ToggleRow";
import { UnsavedBar } from "@/components/settings/UnsavedBar";
import { useToast } from "@/components/ui/toast";
import { useFormState } from "@/hooks/useFormState";
import { api, tokenManager, type PublicProfileSettings, type User as UserType } from "@/lib/api";
import { cn } from "@/lib/utils";

const DEFAULT_SETTINGS: PublicProfileSettings = {
    show_photo: true,
    show_email: true,
    show_phone: true,
    show_talents: true,
    talents_count: 5,
    show_superpowers: true,
    show_motivators: true,
    show_blockers: false,
    show_feedback_style: true,
};

function readSettings(raw?: Partial<PublicProfileSettings>): PublicProfileSettings {
    if (!raw) return DEFAULT_SETTINGS;
    return {
        show_photo: Boolean(raw.show_photo ?? true),
        show_email: Boolean(raw.show_email ?? true),
        show_phone: Boolean(raw.show_phone ?? true),
        show_talents: Boolean(raw.show_talents ?? true),
        talents_count: raw.talents_count === 15 ? 15 : 5,
        show_superpowers: Boolean(raw.show_superpowers ?? true),
        show_motivators: Boolean(raw.show_motivators ?? true),
        show_blockers: Boolean(raw.show_blockers ?? false),
        show_feedback_style: Boolean(raw.show_feedback_style ?? true),
    };
}

const slugValid = (s: string) => /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(s) && s.length >= 3;

export default function PublicProfileSettingsPage() {
    const { toast } = useToast();
    const [currentUser, setCurrentUser] = useState<UserType | null>(null);
    const [settings, setSettings] = useState<PublicProfileSettings>(DEFAULT_SETTINGS);
    const { values, setField, isDirty, hydrate, commit, reset } = useFormState<{ slug: string }>({ slug: "" });
    const [slugSaving, setSlugSaving] = useState(false);
    const [slugError, setSlugError] = useState<string | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const [origin, setOrigin] = useState("");
    const [previewKey, setPreviewKey] = useState(0);

    useEffect(() => {
        setOrigin(window.location.origin);
        const cached = tokenManager.getUser();
        if (!cached) return;
        setCurrentUser(cached);

        api.users.get(cached.id).then((u) => {
            setCurrentUser(u);
            tokenManager.setUser(u);
            hydrate({ slug: u.public_slug ?? "" });
            setSettings(readSettings(u.public_profile_settings));
        });
    }, [hydrate]);

    const effectiveHandle = currentUser?.public_slug || currentUser?.public_token;
    const publicUrl = effectiveHandle ? `${origin}/aboutme/${effectiveHandle}` : null;

    /** Toggles persist immediately; the row rolls back if the request fails. */
    const persist = useCallback(
        async (next: PublicProfileSettings) => {
            if (!currentUser) return;
            const previous = settings;
            setSettings(next);
            try {
                const updated = await api.users.update(currentUser.id, { public_profile_settings: next });
                tokenManager.setUser(updated);
                setCurrentUser(updated);
                setPreviewKey((k) => k + 1);
            } catch (err) {
                setSettings(previous);
                toast("Nie udało się zapisać ustawienia.", "error");
                throw err;
            }
        },
        [currentUser, settings, toast]
    );

    const toggle = (key: keyof PublicProfileSettings) => async (value: boolean) => {
        await persist({ ...settings, [key]: value });
    };

    const handleSlugSave = async () => {
        if (!currentUser) return;
        const slug = values.slug.trim();
        if (slug && !slugValid(slug)) {
            setSlugError("Min. 3 znaki: małe litery, cyfry i myślniki.");
            return;
        }
        setSlugError(null);
        setSlugSaving(true);
        try {
            const updated = await api.users.update(currentUser.id, { public_slug: slug || undefined });
            tokenManager.setUser(updated);
            setCurrentUser(updated);
            commit({ slug: updated.public_slug ?? "" });
            setPreviewKey((k) => k + 1);
            toast("Adres wizytówki zapisany.");
        } catch (e) {
            const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            setSlugError(detail ?? "Ten adres jest zajęty. Wybierz inny.");
        } finally {
            setSlugSaving(false);
        }
    };

    const handleCopy = () => {
        if (!publicUrl) return;
        navigator.clipboard.writeText(publicUrl);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    };

    return (
        <div className="space-y-6">
            <SettingsCard title="Twój publiczny adres" description="Link, który wysyłasz klientom i zespołowi">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="public-slug">Własny adres</Label>
                        <div className="flex flex-wrap gap-2">
                            <div className="flex shrink-0 select-none items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400">
                                /aboutme/
                            </div>
                            <Input
                                id="public-slug"
                                value={values.slug}
                                onChange={(e) => {
                                    setField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                                    setSlugError(null);
                                }}
                                placeholder="jan-kowalski"
                                className="flex-1 font-mono"
                                maxLength={64}
                            />
                        </div>
                        <p className={cn("text-xs", slugError ? "text-destructive" : "text-muted-foreground")}>
                            {slugError ?? "Puste pole = automatyczny, losowy adres."}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        {publicUrl ? (
                            <>
                                <span className="flex-1 truncate font-mono text-sm text-slate-600">{publicUrl}</span>
                                <div className="flex shrink-0 items-center gap-1">
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleCopy} aria-label="Kopiuj link">
                                        {linkCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                    <a href={publicUrl} target="_blank" rel="noopener noreferrer" aria-label="Otwórz wizytówkę">
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    </a>
                                </div>
                            </>
                        ) : (
                            <span className="text-sm text-muted-foreground">
                                Brak adresu — skontaktuj się z administratorem.
                            </span>
                        )}
                    </div>
                </div>
            </SettingsCard>

            <div className="grid gap-6 lg:grid-cols-2">
                <SettingsCard title="Co widzą odbiorcy" description="Każda zmiana zapisuje się od razu">
                    <div className="divide-y divide-slate-100">
                        <ToggleRow label="Zdjęcie profilowe" checked={settings.show_photo} onChange={toggle("show_photo")} />
                        <ToggleRow label="Adres email" checked={settings.show_email} onChange={toggle("show_email")} />
                        <ToggleRow label="Numer telefonu" checked={settings.show_phone} onChange={toggle("show_phone")} />
                        <div>
                            <ToggleRow label="Talenty Gallup" checked={settings.show_talents} onChange={toggle("show_talents")} />
                            {settings.show_talents && (
                                <div className="ml-1 flex items-center gap-2 border-l-2 border-slate-100 py-2 pl-4">
                                    <span className="mr-1 text-xs text-slate-500">Wyświetlaj:</span>
                                    <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                                        {([5, 15] as const).map((count) => (
                                            <button
                                                key={count}
                                                onClick={() => persist({ ...settings, talents_count: count }).catch(() => {})}
                                                aria-pressed={settings.talents_count === count}
                                                className={cn(
                                                    "rounded-md px-3 py-1 text-xs font-medium transition-all",
                                                    settings.talents_count === count
                                                        ? "bg-white text-indigo-600 shadow-sm"
                                                        : "text-slate-500 hover:text-slate-700"
                                                )}
                                            >
                                                Top {count}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <ToggleRow label="Mocne strony (supermoce)" checked={settings.show_superpowers} onChange={toggle("show_superpowers")} />
                        <ToggleRow label="Wyzwalacze i motywatory" checked={settings.show_motivators} onChange={toggle("show_motivators")} />
                        <ToggleRow label="Blokady i ograniczenia" checked={settings.show_blockers} onChange={toggle("show_blockers")} />
                        <ToggleRow label="Jak mi dawać feedback" checked={settings.show_feedback_style} onChange={toggle("show_feedback_style")} />
                    </div>

                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-medium text-slate-700">Treść wizytówki edytujesz gdzie indziej</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Talenty oraz instrukcja obsługi (mocne strony, motywatory, blokady, feedback) mieszkają w „Moim
                            profilu”. Tutaj decydujesz tylko, co z tego pokazujesz.
                        </p>
                        <Link
                            href="/dashboard/my-talents"
                            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                            Przejdź do Mojego profilu
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                </SettingsCard>

                <SettingsCard
                    title="Podgląd"
                    description="Dokładnie to, co zobaczy odbiorca linku"
                    aside={
                        publicUrl && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setPreviewKey((k) => k + 1)}
                                aria-label="Odśwież podgląd"
                            >
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        )
                    }
                >
                    {publicUrl ? (
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            <iframe
                                key={previewKey}
                                src={publicUrl}
                                title="Podgląd wizytówki"
                                className="h-[560px] w-full bg-white"
                                loading="lazy"
                            />
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Podgląd pojawi się, gdy wizytówka będzie miała adres.
                        </p>
                    )}
                </SettingsCard>
            </div>

            <UnsavedBar
                visible={isDirty}
                saving={slugSaving}
                onSave={handleSlugSave}
                onReset={() => {
                    setSlugError(null);
                    reset();
                }}
                label="Zmieniłeś adres wizytówki"
            />
        </div>
    );
}
