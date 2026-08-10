"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Camera, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { UnsavedBar } from "@/components/settings/UnsavedBar";
import { useToast } from "@/components/ui/toast";
import { useFormState } from "@/hooks/useFormState";
import { setLocale, getLocaleFromCookie, type Locale } from "@/lib/locale";
import { api, tokenManager, type User as UserType } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ProfileForm {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    linkedin: string;
    jobTitle: string;
    jobTitleEn: string;
    gallupCertified: boolean;
    gallupProfileUrl: string;
}

const EMPTY_PROFILE: ProfileForm = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    linkedin: "",
    jobTitle: "",
    jobTitleEn: "",
    gallupCertified: false,
    gallupProfileUrl: "",
};

function toForm(u: UserType): ProfileForm {
    const parts = u.full_name.trim().split(" ");
    return {
        firstName: parts[0] ?? "",
        lastName: parts.slice(1).join(" "),
        email: u.email,
        phone: u.phone ?? "",
        linkedin: u.linkedin_url ?? "",
        jobTitle: u.job_title ?? "",
        jobTitleEn: u.job_title_en ?? "",
        gallupCertified: Boolean(u.gallup_certified),
        gallupProfileUrl: u.gallup_profile_url ?? "",
    };
}

/** Pulls a FastAPI/pydantic 422 message for a field, else null. */
function extractValidationError(err: unknown, fieldName: string): string | null {
    const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
    if (Array.isArray(detail)) {
        const issue = detail.find(
            (item) => Array.isArray((item as { loc?: unknown[] })?.loc) && (item as { loc: unknown[] }).loc.includes(fieldName)
        ) as { msg?: string } | undefined;
        if (issue?.msg) return issue.msg.replace(/^Value error,\s*/, "");
    }
    if (typeof detail === "string") return detail;
    return null;
}

export default function AccountSettingsPage() {
    const router = useRouter();
    const t = useTranslations("settings");
    const { toast } = useToast();

    const [currentUser, setCurrentUser] = useState<UserType | null>(null);
    const { values, setField, isDirty, hydrate, commit, reset } = useFormState<ProfileForm>(EMPTY_PROFILE);
    const [saving, setSaving] = useState(false);

    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordSaving, setPasswordSaving] = useState(false);

    const [currentLang, setCurrentLang] = useState<Locale>(getLocaleFromCookie());
    const [langSaving, setLangSaving] = useState(false);

    useEffect(() => {
        const cached = tokenManager.getUser();
        if (!cached) return;
        setCurrentUser(cached);
        setAvatarPreview(cached.avatar_url ?? null);
        hydrate(toForm(cached));

        api.users.get(cached.id).then((u) => {
            setCurrentUser(u);
            setAvatarPreview(u.avatar_url ?? null);
            tokenManager.setUser(u);
            hydrate(toForm(u));
        });
    }, [hydrate]);

    const isCoach = currentUser?.role === "coach";

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentUser || !file.type.startsWith("image/")) return;

        setAvatarUploading(true);
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement("canvas");
                const MAX = 256;
                const scale = Math.min(MAX / img.width, MAX / img.height, 1);
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
                const compressed = canvas.toDataURL("image/jpeg", 0.85);

                setAvatarPreview(compressed);
                try {
                    const updated = await api.users.update(currentUser.id, { avatar_url: compressed });
                    tokenManager.setUser(updated);
                    setCurrentUser(updated);
                    toast("Zdjęcie profilowe zaktualizowane.");
                } catch {
                    setAvatarPreview(currentUser.avatar_url ?? null);
                    toast("Nie udało się zapisać zdjęcia.", "error");
                } finally {
                    setAvatarUploading(false);
                }
            };
            img.src = ev.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleProfileSave = async () => {
        if (!currentUser) return;
        setSaving(true);
        try {
            const payload: Record<string, unknown> = {
                full_name: `${values.firstName.trim()} ${values.lastName.trim()}`.trim(),
                email: values.email,
                phone: values.phone || undefined,
                linkedin_url: values.linkedin || undefined,
            };
            if (isCoach) {
                payload.gallup_certified = values.gallupCertified;
                payload.gallup_profile_url = values.gallupProfileUrl || undefined;
            } else {
                payload.job_title = values.jobTitle || undefined;
                payload.job_title_en = values.jobTitleEn || undefined;
            }
            const updated = await api.users.update(currentUser.id, payload);
            tokenManager.setUser(updated);
            setCurrentUser(updated);
            commit();
            toast("Dane konta zostały zapisane.");
        } catch (err) {
            toast(extractValidationError(err, "gallup_profile_url") ?? "Błąd zapisu. Spróbuj ponownie.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async () => {
        if (newPassword !== confirmPassword) {
            toast("Nowe hasła nie są zgodne.", "error");
            return;
        }
        if (newPassword.length < 8) {
            toast("Nowe hasło musi mieć co najmniej 8 znaków.", "error");
            return;
        }
        setPasswordSaving(true);
        try {
            await api.users.changePassword(currentPassword, newPassword);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            toast("Hasło zostało zmienione.");
        } catch {
            toast("Nieprawidłowe aktualne hasło.", "error");
        } finally {
            setPasswordSaving(false);
        }
    };

    const handleLanguageChange = async (lang: Locale) => {
        if (lang === currentLang || !currentUser) return;
        setLangSaving(true);
        try {
            await api.users.update(currentUser.id, { language: lang });
            setCurrentLang(lang);
            setLocale(lang);
            router.refresh();
        } catch {
            toast("Nie udało się zmienić języka.", "error");
        } finally {
            setLangSaving(false);
        }
    };

    const initials =
        currentUser?.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "";

    return (
        <div className="space-y-6">
            <SettingsCard title="Dane osobowe" description="Widoczne dla Twojego zespołu i na wizytówce">
                <div className="space-y-5">
                    <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                        <div className="relative shrink-0">
                            <div className="flex aspect-square h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-600">
                                {avatarPreview ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                                ) : (
                                    <span className="text-2xl font-bold text-white">{initials}</span>
                                )}
                            </div>
                            <button
                                onClick={() => avatarInputRef.current?.click()}
                                disabled={avatarUploading}
                                aria-label="Zmień zdjęcie profilowe"
                                className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50"
                            >
                                <Camera className="h-3.5 w-3.5 text-slate-600" />
                            </button>
                            <input
                                ref={avatarInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAvatarChange}
                            />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{currentUser?.full_name || "—"}</p>
                            <p className="truncate text-sm text-muted-foreground">{currentUser?.email}</p>
                            <button
                                onClick={() => avatarInputRef.current?.click()}
                                className="mt-1 text-xs text-primary hover:underline"
                            >
                                {avatarUploading ? "Zapisywanie…" : "Zmień zdjęcie"}
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="first-name">Imię</Label>
                            <Input
                                id="first-name"
                                value={values.firstName}
                                onChange={(e) => setField("firstName", e.target.value)}
                                placeholder="Jan"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="last-name">Nazwisko</Label>
                            <Input
                                id="last-name"
                                value={values.lastName}
                                onChange={(e) => setField("lastName", e.target.value)}
                                placeholder="Kowalski"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Adres email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={values.email}
                            onChange={(e) => setField("email", e.target.value)}
                            placeholder="jan@firma.pl"
                        />
                        <p className="text-xs text-muted-foreground">Adres służy również do logowania.</p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefon</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={values.phone}
                                onChange={(e) => setField("phone", e.target.value)}
                                placeholder="+48 600 000 000"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="linkedin">LinkedIn</Label>
                            <Input
                                id="linkedin"
                                type="url"
                                value={values.linkedin}
                                onChange={(e) => setField("linkedin", e.target.value)}
                                placeholder="linkedin.com/in/…"
                            />
                        </div>
                    </div>

                    {!isCoach && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="job-title">Stanowisko (PL)</Label>
                                <Input
                                    id="job-title"
                                    value={values.jobTitle}
                                    onChange={(e) => setField("jobTitle", e.target.value)}
                                    placeholder="np. Senior Developer"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="job-title-en">Stanowisko (EN)</Label>
                                <Input
                                    id="job-title-en"
                                    value={values.jobTitleEn}
                                    onChange={(e) => setField("jobTitleEn", e.target.value)}
                                    placeholder="e.g. Senior Developer"
                                />
                            </div>
                        </div>
                    )}

                    {isCoach && (
                        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <Label htmlFor="gallup-certified" className="text-sm font-medium text-slate-700">
                                    {t("gallup.certifiedLabel")}
                                </Label>
                                <Switch
                                    id="gallup-certified"
                                    checked={values.gallupCertified}
                                    onCheckedChange={(v) => setField("gallupCertified", v)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gallup-profile-url">{t("gallup.profileUrlLabel")}</Label>
                                <Input
                                    id="gallup-profile-url"
                                    type="url"
                                    value={values.gallupProfileUrl}
                                    onChange={(e) => setField("gallupProfileUrl", e.target.value)}
                                    disabled={!values.gallupCertified}
                                    placeholder={t("gallup.profileUrlPlaceholder")}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </SettingsCard>

            <SettingsCard
                title="Twoje talenty i instrukcja obsługi"
                description="Import raportu Gallup i opis stylu współpracy"
                aside={
                    <Link
                        href="/dashboard/my-talents"
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                        Otwórz
                        <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                }
            >
                <p className="text-sm text-muted-foreground">
                    Raport Gallup wgrywasz i edytujesz w „Moich talentach”. Tutaj zostają wyłącznie dane konta, a to,
                    co z profilu pokazujesz publicznie, ustawiasz w zakładce{" "}
                    <Link href="/dashboard/settings/public-profile" className="text-primary hover:underline">
                        Moja wizytówka
                    </Link>
                    .
                </p>
            </SettingsCard>

            <SettingsCard title={t("language.title")} description="Zmiana działa od razu — nie wymaga zapisu">
                <div className="flex gap-2">
                    {(["pl", "en"] as Locale[]).map((lang) => (
                        <button
                            key={lang}
                            onClick={() => handleLanguageChange(lang)}
                            disabled={langSaving}
                            aria-pressed={currentLang === lang}
                            className={cn(
                                "rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                                currentLang === lang
                                    ? "border-primary bg-primary text-white"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-primary hover:text-primary"
                            )}
                        >
                            {t(`language.${lang}`)}
                        </button>
                    ))}
                    {langSaving && <span className="self-center text-sm text-slate-500">{t("language.saving")}</span>}
                </div>
            </SettingsCard>

            <SettingsCard title="Hasło" description="Minimum 8 znaków">
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                        <Label htmlFor="current-password">Aktualne hasło</Label>
                        <Input
                            id="current-password"
                            type="password"
                            autoComplete="current-password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-password">Nowe hasło</Label>
                        <Input
                            id="new-password"
                            type="password"
                            autoComplete="new-password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Min. 8 znaków"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">Powtórz nowe hasło</Label>
                        <Input
                            id="confirm-password"
                            type="password"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                </div>
                <Button
                    variant="outline"
                    onClick={handlePasswordChange}
                    disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                    className="mt-4"
                >
                    <Lock className="mr-2 h-4 w-4" />
                    {passwordSaving ? "Zmieniam…" : "Zmień hasło"}
                </Button>
            </SettingsCard>

            <UnsavedBar visible={isDirty} saving={saving} onSave={handleProfileSave} onReset={reset} />
        </div>
    );
}
