"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TalentImportDialog } from "@/components/talent-import/TalentImportDialog";
import { DomainBadge } from "@/components/ui/DomainBadge";
import {
  Building2,
  Users,
  Bell,
  Shield,
  Palette,
  Globe,
  ChevronRight,
  Save,
  Upload,
  Sparkles,
  User,
  Lock,
  Camera,
  Link2,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import { SettingsSection } from "@/components/dashboard/SettingsSection";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { GALLUP_TALENTS } from "@/lib/gallup-data";
import { UserTalent } from "@/types/talent";
import { api, tokenManager, type User as UserType, type Organization } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [talentImportOpen, setTalentImportOpen] = useState(false);
  const [myTalents, setMyTalents] = useState<UserTalent[]>([]);

  // Current user data
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Profile form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobTitleEn, setJobTitleEn] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Organization form
  const [orgName, setOrgName] = useState("");
  const [orgStreet, setOrgStreet] = useState("");
  const [orgPostalCode, setOrgPostalCode] = useState("");
  const [orgCity, setOrgCity] = useState("");
  const [orgTaxId, setOrgTaxId] = useState("");
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgMsg, setOrgMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Create-organization modal (admin / coach)
  const [orgCreateOpen, setOrgCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgStreet, setNewOrgStreet] = useState("");
  const [newOrgPostal, setNewOrgPostal] = useState("");
  const [newOrgCity, setNewOrgCity] = useState("");
  const [newOrgTaxId, setNewOrgTaxId] = useState("");
  const [newOrgSaving, setNewOrgSaving] = useState(false);
  const [newOrgMsg, setNewOrgMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // User Manual
  const [manualLang, setManualLang] = useState<"pl" | "en">("pl");
  const [superpowers, setSuperpowers] = useState("");
  const [motivators, setMotivators] = useState("");
  const [blockers, setBlockers] = useState("");
  const [feedbackStyle, setFeedbackStyle] = useState("");
  
  const [superpowersEn, setSuperpowersEn] = useState("");
  const [motivatorsEn, setMotivatorsEn] = useState("");
  const [blockersEn, setBlockersEn] = useState("");
  const [feedbackStyleEn, setFeedbackStyleEn] = useState("");

  const [manualSaving, setManualSaving] = useState(false);
  const [manualMsg, setManualMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // AI Translation
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateMsg, setTranslateMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Wizytówka copy + slug
  const [linkCopied, setLinkCopied] = useState(false);
  const [publicSlug, setPublicSlug] = useState("");
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugMsg, setSlugMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Privacy settings for wizytówka
  const [sharePhoto, setSharePhoto] = useState(true);
  const [shareEmail, setShareEmail] = useState(true);
  const [sharePhone, setSharePhone] = useState(true);
  const [shareTalents, setShareTalents] = useState(true);
  const [talentsCount, setTalentsCount] = useState<5 | 15>(5);
  const [shareSuperpowers, setShareSuperpowers] = useState(true);
  const [shareMotivators, setShareMotivators] = useState(true);
  const [shareBlockers, setShareBlockers] = useState(false);
  const [shareFeedback, setShareFeedback] = useState(true);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacyMsg, setPrivacyMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const user = tokenManager.getUser();
    if (!user) return;
    setCurrentUser(user);
    setAvatarPreview(user.avatar_url ?? null);
    initUserFields(user);

    // Load fresh user data from API
    api.users.get(user.id).then((u) => {
      setCurrentUser(u);
      setAvatarPreview(u.avatar_url ?? null);
      initUserFields(u);
      tokenManager.setUser(u);
      setPublicSlug(u.public_slug ?? "");
      // User Manual fields
      const ud = u as typeof u & { superpowers?: string; motivators?: string; blockers?: string; feedback_style?: string; superpowers_en?: string; motivators_en?: string; blockers_en?: string; feedback_style_en?: string; };
      setSuperpowers(ud.superpowers ?? "");
      setMotivators(ud.motivators ?? "");
      setBlockers(ud.blockers ?? "");
      setFeedbackStyle(ud.feedback_style ?? "");

      setSuperpowersEn(ud.superpowers_en ?? "");
      setMotivatorsEn(ud.motivators_en ?? "");
      setBlockersEn(ud.blockers_en ?? "");
      setFeedbackStyleEn(ud.feedback_style_en ?? "");

      // Load privacy settings from public_profile_settings
      if ((u as UserType & { public_profile_settings?: Record<string, boolean | number> }).public_profile_settings) {
        const s = (u as UserType & { public_profile_settings?: Record<string, boolean | number> }).public_profile_settings!;
        setSharePhoto(Boolean(s.show_photo ?? true));
        setShareEmail(Boolean(s.show_email ?? true));
        setSharePhone(Boolean(s.show_phone ?? true));
        setShareTalents(Boolean(s.show_talents ?? true));
        setTalentsCount(s.talents_count === 15 ? 15 : 5);
        setShareSuperpowers(Boolean(s.show_superpowers ?? true));
        setShareMotivators(Boolean(s.show_motivators ?? true));
        setShareBlockers(Boolean(s.show_blockers ?? false));
        setShareFeedback(Boolean(s.show_feedback_style ?? true));
      }
    });

    // Load organization
    api.organizations.get(user.organization_id).then((o) => {
      setOrg(o);
      setOrgName(o.name);
      setOrgStreet(o.street ?? "");
      setOrgPostalCode(o.postal_code ?? "");
      setOrgCity(o.city ?? "");
      setOrgTaxId(o.tax_id ?? "");
    });
  }, []);

  function initUserFields(u: UserType) {
    const parts = u.full_name.trim().split(" ");
    setFirstName(parts[0] ?? "");
    setLastName(parts.slice(1).join(" "));
    setEmail(u.email);
    setPhone(u.phone ?? "");
    setLinkedin(u.linkedin_url ?? "");
    setJobTitle(u.job_title ?? "");
    setJobTitleEn(u.job_title_en ?? "");
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    if (!file.type.startsWith("image/")) return;

    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      // Resize/compress to canvas
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
        } catch {
          // ignore
        } finally {
          setAvatarUploading(false);
        }
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
  };

  const handleTalentsSave = (talents: UserTalent[]) => {
    setMyTalents(talents);
  };

  const handleProfileSave = async () => {
    if (!currentUser) return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const full_name = `${firstName.trim()} ${lastName.trim()}`.trim();
      const updated = await api.users.update(currentUser.id, {
        full_name,
        email,
        phone: phone || undefined,
        linkedin_url: linkedin || undefined,
        job_title: jobTitle || undefined,
        job_title_en: jobTitleEn || undefined,
      });
      tokenManager.setUser(updated);
      setCurrentUser(updated);
      setProfileMsg({ type: "success", text: "Dane zostały zapisane." });
    } catch {
      setProfileMsg({ type: "error", text: "Błąd zapisu. Spróbuj ponownie." });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Nowe hasła nie są zgodne." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "Nowe hasło musi mieć co najmniej 8 znaków." });
      return;
    }
    setPasswordSaving(true);
    try {
      await api.users.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg({ type: "success", text: "Hasło zostało zmienione." });
    } catch {
      setPasswordMsg({ type: "error", text: "Nieprawidłowe aktualne hasło." });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleOrgSave = async () => {
    if (!org) return;
    setOrgSaving(true);
    setOrgMsg(null);
    try {
      const updated = await api.organizations.update(org.id, {
        name: orgName || undefined,
        street: orgStreet || undefined,
        postal_code: orgPostalCode || undefined,
        city: orgCity || undefined,
        tax_id: orgTaxId || undefined,
      });
      setOrg(updated);
      setOrgMsg({ type: "success", text: "Dane organizacji zostały zapisane." });
    } catch {
      setOrgMsg({ type: "error", text: "Błąd zapisu. Sprawdź uprawnienia." });
    } finally {
      setOrgSaving(false);
    }
  };

  const openOrgCreateModal = () => {
    setNewOrgName("");
    setNewOrgStreet("");
    setNewOrgPostal("");
    setNewOrgCity("");
    setNewOrgTaxId("");
    setNewOrgMsg(null);
    setOrgCreateOpen(true);
  };

  const handleOrgCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewOrgMsg(null);
    setNewOrgSaving(true);
    try {
      await api.organizations.create({
        name: newOrgName.trim(),
        street: newOrgStreet.trim() || undefined,
        postal_code: newOrgPostal.trim() || undefined,
        city: newOrgCity.trim() || undefined,
        tax_id: newOrgTaxId.trim() || undefined,
      });
      setOrgCreateOpen(false);
      setOrgMsg({ type: "success", text: "Organizacja została utworzona." });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      const detail = error?.response?.data?.detail;
      setNewOrgMsg({ type: "error", text: typeof detail === "string" ? detail : "Nie udało się utworzyć organizacji." });
    } finally {
      setNewOrgSaving(false);
    }
  };

  const handlePrivacySave = async () => {
    if (!currentUser) return;
    setPrivacySaving(true);
    setPrivacyMsg(null);
    try {
      const settings = {
        show_photo: sharePhoto,
        show_email: shareEmail,
        show_phone: sharePhone,
        show_talents: shareTalents,
        talents_count: talentsCount,
        show_superpowers: shareSuperpowers,
        show_motivators: shareMotivators,
        show_blockers: shareBlockers,
        show_feedback_style: shareFeedback,
      };
      const updated = await api.users.update(currentUser.id, {
        public_profile_settings: settings,
      });
      tokenManager.setUser(updated);
      setCurrentUser(updated);
      setPrivacyMsg({ type: "success", text: "Ustawienia prywatności zapisane." });
    } catch {
      setPrivacyMsg({ type: "error", text: "Błąd zapisu." });
    } finally {
      setPrivacySaving(false);
    }
  };

  const handleManualSave = async () => {
    if (!currentUser) return;
    setManualSaving(true);
    setManualMsg(null);
    try {
      const updated = await api.users.update(currentUser.id, {
        superpowers: superpowers || undefined,
        motivators: motivators || undefined,
        blockers: blockers || undefined,
        feedback_style: feedbackStyle || undefined,
        superpowers_en: superpowersEn || undefined,
        motivators_en: motivatorsEn || undefined,
        blockers_en: blockersEn || undefined,
        feedback_style_en: feedbackStyleEn || undefined,
      });
      tokenManager.setUser(updated);
      setCurrentUser(updated);
      setManualMsg({ type: "success", text: "Instrukcja obsługi zapisana." });
    } catch {
      setManualMsg({ type: "error", text: "Błąd zapisu." });
    } finally {
      setManualSaving(false);
    }
  };

  const handleTranslateProfile = async () => {
    setIsTranslating(true);
    setTranslateMsg(null);
    try {
      const translation = await api.users.translateProfile();
      setJobTitleEn(translation.job_title_en || "");
      setSuperpowersEn(translation.superpowers_en || "");
      setMotivatorsEn(translation.motivators_en || "");
      setBlockersEn(translation.blockers_en || "");
      setFeedbackStyleEn(translation.feedback_style_en || "");
      
      setManualLang("en"); // Switch to EN to show the translated text
      setTranslateMsg({ type: "success", text: "Tłumaczenie AI wygenerowane. Zapisz profil by zachować." });
    } catch {
      setTranslateMsg({ type: "error", text: "Błąd podczas tłumaczenia." });
    } finally {
      setIsTranslating(false);
    }
  };

  const slugValid = (s: string) => /^[a-z0-9][a-z0-9\-]*[a-z0-9]$/.test(s) && s.length >= 3;

  const handleSlugSave = async () => {
    if (!currentUser) return;
    if (publicSlug && !slugValid(publicSlug)) {
      setSlugMsg({ type: "error", text: "Slug może zawierać tylko małe litery, cyfry i myślniki (min. 3 znaki)." });
      return;
    }
    setSlugSaving(true);
    setSlugMsg(null);
    try {
      const updated = await api.users.update(currentUser.id, { public_slug: publicSlug || undefined });
      tokenManager.setUser(updated);
      setCurrentUser(updated);
      setPublicSlug(updated.public_slug ?? "");
      setSlugMsg({ type: "success", text: "Slug zapisany." });
    } catch (e: unknown) {
      const error = e as { response?: { data?: { detail?: string } } };
      const detail = error?.response?.data?.detail;
      setSlugMsg({ type: "error", text: detail ?? "Błąd zapisu. Spróbuj inny slug." });
    } finally {
      setSlugSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!wizytowkaUrl) return;
    navigator.clipboard.writeText(wizytowkaUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const isManager = currentUser?.role === "manager";
  const canCreateOrg = currentUser?.role === "admin" || currentUser?.role === "coach";
  const publicToken = currentUser?.public_token;
  const effectiveHandle = currentUser?.public_slug || publicToken;
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const wizytowkaUrl = effectiveHandle
    ? `${origin}/aboutme/${effectiveHandle}`
    : null;

  // Avatar display helper
  const initials = currentUser?.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "";

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div>
        <h1 className="text-headline">Ustawienia</h1>
        <p className="text-body">Zarządzaj ustawieniami konta i organizacji</p>
      </div>

      {/* Row 1: Profile (wider) + Password */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* User Profile — takes 3/5 */}
        <SettingsSection
          icon={User}
          title="Mój profil"
          description="Dane osobowe i kontaktowe"
          className="lg:col-span-3"
        >
          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4 sm:gap-5 min-w-0">
              <div className="relative shrink-0">
                <div className="h-20 w-20 aspect-square rounded-2xl overflow-hidden bg-blue-600 flex items-center justify-center shrink-0">
                  {avatarPreview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                    </>
                  ) : (
                    <span className="text-white font-bold text-2xl">{initials}</span>
                  )}
                </div>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors"
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
                <p className="font-medium text-slate-900 truncate">{currentUser?.full_name || "—"}</p>
                <p className="text-sm text-muted-foreground truncate">{currentUser?.email}</p>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="text-xs text-primary hover:underline mt-1"
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
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Nazwisko</Label>
                <Input
                  id="last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Kowalski"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Adres email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jan@firma.pl"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+48 600 000 000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  type="url"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="linkedin.com/in/…"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="job-title">Stanowisko (PL)</Label>
                <Input
                  id="job-title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="np. Senior Developer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-title-en">Stanowisko (EN)</Label>
                <Input
                  id="job-title-en"
                  value={jobTitleEn}
                  onChange={(e) => setJobTitleEn(e.target.value)}
                  placeholder="e.g. Senior Developer"
                />
              </div>
            </div>
            {profileMsg && (
              <p className={cn("text-sm", profileMsg.type === "success" ? "text-green-600" : "text-destructive")}>
                {profileMsg.text}
              </p>
            )}
            <Button variant="hero" onClick={handleProfileSave} disabled={profileSaving}>
              <Save className="h-4 w-4 mr-2" />
              {profileSaving ? "Zapisywanie…" : "Zapisz dane profilu"}
            </Button>
          </div>
        </SettingsSection>

        {/* Password — takes 2/5 */}
        <SettingsSection
          icon={Lock}
          title="Zmiana hasła"
          description="Zaktualizuj hasło do konta"
          className="lg:col-span-2"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Aktualne hasło</Label>
              <Input
                id="current-password"
                type="password"
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
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {passwordMsg && (
              <p className={cn("text-sm", passwordMsg.type === "success" ? "text-green-600" : "text-destructive")}>
                {passwordMsg.text}
              </p>
            )}
            <Button
              variant="outline"
              onClick={handlePasswordChange}
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              className="w-full"
            >
              <Lock className="h-4 w-4 mr-2" />
              {passwordSaving ? "Zmieniam…" : "Zmień hasło"}
            </Button>
          </div>
        </SettingsSection>
      </div>

      {/* Row 2: Talents (wider) + Organization */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Talent Import — takes 3/5 */}
        <SettingsSection
          icon={Sparkles}
          title="Moje talenty Gallup"
          description="Importuj lub wprowadź swój profil talentowy"
          className="lg:col-span-3"
        >
          <div className="space-y-4">
            {myTalents.length > 0 ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {myTalents.slice(0, 10).map((userTalent) => {
                    const talent = GALLUP_TALENTS.find(t => t.code === userTalent.talentId);
                    if (!talent) return null;
                    const isTop5 = userTalent.rank <= 5;
                    return (
                      <div
                        key={talent.code}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg",
                          isTop5 ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/50"
                        )}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                          isTop5 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          {userTalent.rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{talent.pl}</p>
                        </div>
                        <DomainBadge domain={talent.domain} size="sm" />
                      </div>
                    );
                  })}
                </div>
                {myTalents.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center">
                    + {myTalents.length - 10} więcej talentów
                  </p>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setTalentImportOpen(true)}
                >
                  Edytuj talenty
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="text-center py-4 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Brak zaimportowanych talentów</p>
                  <p className="text-sm text-muted-foreground">
                    Zaimportuj raport Gallup lub wprowadź ręcznie
                  </p>
                </div>
                <Button variant="hero" onClick={() => setTalentImportOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importuj talenty
                </Button>
              </div>
            )}
          </div>
        </SettingsSection>

        {/* Organization — takes 2/5 */}
        <SettingsSection
          icon={Building2}
          title="Organizacja"
          description={isManager ? "Informacje o organizacji" : "Dane organizacji (odczyt)"}
          className="lg:col-span-2"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Nazwa organizacji</Label>
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!isManager}
                placeholder="Nazwa firmy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-street">Ulica i numer</Label>
              <Input
                id="org-street"
                value={orgStreet}
                onChange={(e) => setOrgStreet(e.target.value)}
                disabled={!isManager}
                placeholder="ul. Przykładowa 1"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-postal">Kod pocztowy</Label>
                <Input
                  id="org-postal"
                  value={orgPostalCode}
                  onChange={(e) => setOrgPostalCode(e.target.value)}
                  disabled={!isManager}
                  placeholder="00-000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-city">Miasto</Label>
                <Input
                  id="org-city"
                  value={orgCity}
                  onChange={(e) => setOrgCity(e.target.value)}
                  disabled={!isManager}
                  placeholder="Warszawa"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-nip">NIP</Label>
              <Input
                id="org-nip"
                value={orgTaxId}
                onChange={(e) => setOrgTaxId(e.target.value)}
                disabled={!isManager}
                placeholder="0000000000"
              />
            </div>
            {orgMsg && (
              <p className={cn("text-sm", orgMsg.type === "success" ? "text-green-600" : "text-destructive")}>
                {orgMsg.text}
              </p>
            )}
            {isManager && (
              <Button variant="hero" onClick={handleOrgSave} disabled={orgSaving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {orgSaving ? "Zapisywanie…" : "Zapisz"}
              </Button>
            )}
            {canCreateOrg && (
              <Button variant="outline" onClick={openOrgCreateModal} className="w-full">
                <Building2 className="h-4 w-4 mr-2" />
                Dodaj nową organizację
              </Button>
            )}
          </div>
        </SettingsSection>
      </div>

      {/* Row 3: User Manual — full width */}
      <SettingsSection
        icon={BookOpen}
        title="Instrukcja obsługi"
        description="Powiedz innym jak z Tobą współpracować — widoczne na wizytówce"
      >
        <div className="flex items-center gap-2 mb-4 bg-slate-100 p-1 w-fit rounded-lg border border-slate-200">
          <button
            onClick={() => setManualLang("pl")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              manualLang === "pl" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Polski
          </button>
          <button
            onClick={() => setManualLang("en")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              manualLang === "en" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            English
          </button>
        </div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">
            Wypełnij instrukcję w obu językach lub użyj AI, aby przetłumaczyć polską wersję.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTranslateProfile}
            disabled={isTranslating}
            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {isTranslating ? "Tłumaczenie..." : "Tłumacz z AI"}
          </Button>
        </div>
        {translateMsg && (
          <div className={cn("p-3 rounded-lg mb-4 text-sm", translateMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
            {translateMsg.text}
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          {manualLang === "pl" ? (
            [
              { label: "Moje mocne strony", placeholder: "Co naturalnie wnosisz do zespołu? Jakie masz supermoce?", value: superpowers, set: setSuperpowers },
              { label: "Wyzwalacze i motywatory", placeholder: "Co daje Ci energię? Co sprawia że działasz z pełną mocą?", value: motivators, set: setMotivators },
              { label: "Blokady i ograniczenia", placeholder: "Co Cię spowalnia lub drażni? Na co uważać?", value: blockers, set: setBlockers },
              { label: "Jak mi dawać feedback", placeholder: "Jak chcesz otrzymywać informację zwrotną?", value: feedbackStyle, set: setFeedbackStyle },
            ].map(({ label, placeholder, value, set }) => (
              <div key={label} className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">{label}</Label>
                <textarea
                  className="w-full min-h-[100px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  placeholder={placeholder}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                />
              </div>
            ))
          ) : (
            [
              { label: "Moje mocne strony (EN)", placeholder: "What do you naturally bring to the team?", value: superpowersEn, set: setSuperpowersEn },
              { label: "Wyzwalacze i motywatory (EN)", placeholder: "What gives you energy?", value: motivatorsEn, set: setMotivatorsEn },
              { label: "Blokady i ograniczenia (EN)", placeholder: "What slows you down?", value: blockersEn, set: setBlockersEn },
              { label: "Jak mi dawać feedback (EN)", placeholder: "How do you prefer to receive feedback?", value: feedbackStyleEn, set: setFeedbackStyleEn },
            ].map(({ label, placeholder, value, set }) => (
              <div key={label} className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">{label}</Label>
                <textarea
                  className="w-full min-h-[100px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  placeholder={placeholder}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                />
              </div>
            ))
          )}
        </div>
        {manualMsg && (
          <p className={cn("text-sm mt-2", manualMsg.type === "success" ? "text-green-600" : "text-destructive")}>
            {manualMsg.text}
          </p>
        )}
        <Button variant="hero" onClick={handleManualSave} disabled={manualSaving} className="mt-4">
          <Save className="h-4 w-4 mr-2" />
          {manualSaving ? "Zapisywanie…" : "Zapisz instrukcję obsługi"}
        </Button>
      </SettingsSection>

      {/* Row 4: Wizytówka (wider) + Notifications */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Moja Wizytówka — takes 3/5 */}
        <SettingsSection
          icon={Link2}
          title="Moja wizytówka"
          description="Publiczny link — pokaż innym swoje talenty i styl współpracy"
          className="lg:col-span-3"
        >
          <div className="space-y-5">
            {/* Custom slug */}
            <div className="space-y-2">
              <Label htmlFor="public-slug">Twój slug (własny adres)</Label>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 shrink-0 select-none">
                  /aboutme/
                </div>
                <Input
                  id="public-slug"
                  value={publicSlug}
                  onChange={(e) => {
                    setPublicSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, ""));
                    setSlugMsg(null);
                  }}
                  placeholder="kamiltonkowicz"
                  className="flex-1 font-mono"
                  maxLength={64}
                />
                <Button variant="outline" onClick={handleSlugSave} disabled={slugSaving} className="shrink-0">
                  {slugSaving ? "…" : <Save className="h-4 w-4" />}
                </Button>
              </div>
              {slugMsg ? (
                <p className={cn("text-xs", slugMsg.type === "success" ? "text-green-600" : "text-destructive")}>
                  {slugMsg.text}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Min. 3 znaki, małe litery, cyfry i myślniki. Jeśli puste — używany jest automatyczny token.
                </p>
              )}
            </div>

            {/* Link box */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center gap-3">
              {effectiveHandle ? (
                <>
                  <span className="flex-1 text-sm text-slate-600 truncate font-mono">
                    {wizytowkaUrl}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleCopyLink}>
                      {linkCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <a href={wizytowkaUrl!} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Brak tokenu — skontaktuj się z administratorem
                </span>
              )}
            </div>

            {/* Privacy toggles */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Co jest widoczne na wizytówce?</p>
              
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-700">Zdjęcie profilowe</span>
                <Switch checked={sharePhoto} onCheckedChange={setSharePhoto} />
              </div>
              
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-700">Adres email</span>
                <Switch checked={shareEmail} onCheckedChange={setShareEmail} />
              </div>
              
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-700">Numer telefonu</span>
                <Switch checked={sharePhone} onCheckedChange={setSharePhone} />
              </div>
              
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-700">Talenty Gallup</span>
                <Switch checked={shareTalents} onCheckedChange={setShareTalents} />
              </div>
              
              {shareTalents && (
                <div className="flex items-center gap-2 pl-4 py-1 border-l-2 border-slate-100 ml-1">
                  <span className="text-xs text-slate-500 mr-2">Wyświetlaj:</span>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      onClick={() => setTalentsCount(5)}
                      className={cn(
                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                        talentsCount === 5 
                          ? "bg-white text-indigo-600 shadow-sm" 
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Top 5
                    </button>
                    <button
                      onClick={() => setTalentsCount(15)}
                      className={cn(
                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                        talentsCount === 15 
                          ? "bg-white text-indigo-600 shadow-sm" 
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Top 15
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-700">Mocne strony (supermoce)</span>
                <Switch checked={shareSuperpowers} onCheckedChange={setShareSuperpowers} />
              </div>
              
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-700">Wyzwalacze i motywatory</span>
                <Switch checked={shareMotivators} onCheckedChange={setShareMotivators} />
              </div>
              
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-700">Blokady i ograniczenia</span>
                <Switch checked={shareBlockers} onCheckedChange={setShareBlockers} />
              </div>
              
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-700">Jak mi dawać feedback</span>
                <Switch checked={shareFeedback} onCheckedChange={setShareFeedback} />
              </div>
            </div>
            {privacyMsg && (
              <p className={cn("text-sm", privacyMsg.type === "success" ? "text-green-600" : "text-destructive")}>
                {privacyMsg.text}
              </p>
            )}
            <Button variant="hero" onClick={handlePrivacySave} disabled={privacySaving}>
              <Save className="h-4 w-4 mr-2" />
              {privacySaving ? "Zapisywanie…" : "Zapisz ustawienia wizytówki"}
            </Button>
          </div>
        </SettingsSection>

        {/* Notifications — takes 2/5 */}
        <SettingsSection
          icon={Bell}
          title="Powiadomienia"
          description="Alerty i przypomnienia"
          className="lg:col-span-2"
        >
          <div className="space-y-4">
            {[
              { label: "Dzienne wskazówki", sub: "Codziennie rano", defaultOn: true },
              { label: "Przypomnienia 1:1", sub: "Briefing przed spotkaniem", defaultOn: true },
              { label: "Tygodniowe podsumowanie", sub: "Raport aktywności", defaultOn: false },
              { label: "Powiadomienia email", sub: "Alerty na email", defaultOn: true },
            ].map(({ label, sub, defaultOn }) => (
              <div key={label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
                <Switch defaultChecked={defaultOn} />
              </div>
            ))}
          </div>
        </SettingsSection>
      </div>

      {/* Row 5: Team management + Privacy/security */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SettingsSection
          icon={Users}
          title="Zarządzanie zespołem"
          description="Role i uprawnienia"
        >
          <div className="space-y-3">
            {[
              { role: "Administratorzy", desc: "Pełny dostęp", count: "1 osoba" },
              { role: "Menedżerowie", desc: "Zarządzanie zespołem", count: "2 osoby" },
              { role: "Użytkownicy", desc: "Podstawowy dostęp", count: "3 osoby" },
            ].map(({ role, desc, count }) => (
              <div key={role} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{role}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <span className="text-xs text-muted-foreground">{count}</span>
              </div>
            ))}
            <Button variant="outline" className="w-full mt-1">
              Zarządzaj użytkownikami
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Shield}
          title="Prywatność i bezpieczeństwo"
          description="Ustawienia prywatności danych"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Widoczność profilu</p>
                <p className="text-xs text-muted-foreground">Zarządzaj widocznością w zespole</p>
              </div>
              <Button variant="outline" size="sm">Zmień</Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Dwuskładnikowe (2FA)</p>
                <p className="text-xs text-muted-foreground">Dodatkowa warstwa bezpieczeństwa</p>
              </div>
              <Switch />
            </div>
            <Button variant="outline" className="w-full">
              Eksportuj dane
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </SettingsSection>
      </div>

      {/* Extensions — Post MVP */}
      <div className="space-y-3">
        <h3 className="text-title text-muted-foreground flex items-center gap-2">
          Rozszerzenia{" "}
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-bold">WKRÓTCE</span>
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-dashed bg-muted/30 p-5 opacity-60">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-muted p-2">
                <Globe className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">Integracja z kalendarzem</span>
            </div>
            <p className="text-sm text-muted-foreground">Automatyczny briefing przed spotkaniami</p>
          </div>
          <div className="rounded-2xl border border-dashed bg-muted/30 p-5 opacity-60">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-muted p-2">
                <Palette className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">Zdrowie organizacji</span>
            </div>
            <p className="text-sm text-muted-foreground">Widok heatmapy dla całej firmy</p>
          </div>
        </div>
      </div>

      {/* Create Organization Dialog */}
      <Dialog open={orgCreateOpen} onOpenChange={setOrgCreateOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Building2 className="h-5 w-5 text-blue-600" />
              Dodaj organizację
            </DialogTitle>
            <DialogDescription>
              Utwórz nową organizację. Pola adresowe i NIP są opcjonalne.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleOrgCreate} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="settings-new-org-name">Nazwa organizacji</Label>
              <Input
                id="settings-new-org-name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                required
                minLength={1}
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-new-org-street">Ulica i numer</Label>
              <Input
                id="settings-new-org-street"
                value={newOrgStreet}
                onChange={(e) => setNewOrgStreet(e.target.value)}
                maxLength={255}
                placeholder="ul. Przykładowa 1"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="settings-new-org-postal">Kod pocztowy</Label>
                <Input
                  id="settings-new-org-postal"
                  value={newOrgPostal}
                  onChange={(e) => setNewOrgPostal(e.target.value)}
                  maxLength={20}
                  placeholder="00-000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-new-org-city">Miasto</Label>
                <Input
                  id="settings-new-org-city"
                  value={newOrgCity}
                  onChange={(e) => setNewOrgCity(e.target.value)}
                  maxLength={120}
                  placeholder="Warszawa"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-new-org-nip">NIP</Label>
              <Input
                id="settings-new-org-nip"
                value={newOrgTaxId}
                onChange={(e) => setNewOrgTaxId(e.target.value)}
                maxLength={32}
                placeholder="0000000000"
              />
            </div>
            {newOrgMsg && (
              <p className={cn("text-sm", newOrgMsg.type === "success" ? "text-green-600" : "text-destructive")}>
                {newOrgMsg.text}
              </p>
            )}
            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={newOrgSaving}>Anuluj</Button>
              </DialogClose>
              <Button type="submit" variant="hero" disabled={newOrgSaving}>
                <Save className="h-4 w-4 mr-2" />
                {newOrgSaving ? "Tworzenie…" : "Utwórz organizację"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Talent Import Dialog */}
      <TalentImportDialog
        open={talentImportOpen}
        onOpenChange={setTalentImportOpen}
        onSave={handleTalentsSave}
        initialTalents={myTalents}
        memberName="Moje talenty"
        userId={tokenManager.getUser()?.id}
      />
    </div>
  );
}
