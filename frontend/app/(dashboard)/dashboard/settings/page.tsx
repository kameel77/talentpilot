"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { SettingsSection } from "@/components/dashboard/SettingsSection";
import { GALLUP_TALENTS } from "@/data/gallupTalents";
import { UserTalent } from "@/types/talent";
import { api, tokenManager, type User as UserType, type Organization } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [talentImportOpen, setTalentImportOpen] = useState(false);
  const [myTalents, setMyTalents] = useState<UserTalent[]>([]);

  // Current user data
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);

  // Profile form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
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
  const [orgAddress, setOrgAddress] = useState("");
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgMsg, setOrgMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const user = tokenManager.getUser();
    if (!user) return;
    setCurrentUser(user);

    // Split full_name into first/last
    const parts = user.full_name.trim().split(" ");
    setFirstName(parts[0] ?? "");
    setLastName(parts.slice(1).join(" "));
    setEmail(user.email);
    setPhone(user.phone ?? "");
    setLinkedin(user.linkedin_url ?? "");

    // Load fresh user data from API
    api.users.get(user.id).then((u) => {
      setCurrentUser(u);
      const p = u.full_name.trim().split(" ");
      setFirstName(p[0] ?? "");
      setLastName(p.slice(1).join(" "));
      setEmail(u.email);
      setPhone(u.phone ?? "");
      setLinkedin(u.linkedin_url ?? "");
      tokenManager.setUser(u);
    });

    // Load organization
    api.organizations.get(user.organization_id).then((o) => {
      setOrg(o);
      setOrgName(o.name);
      setOrgAddress(o.address ?? "");
    });
  }, []);

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
        address: orgAddress || undefined,
      });
      setOrg(updated);
      setOrgMsg({ type: "success", text: "Dane organizacji zostały zapisane." });
    } catch {
      setOrgMsg({ type: "error", text: "Błąd zapisu. Sprawdź uprawnienia." });
    } finally {
      setOrgSaving(false);
    }
  };

  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-headline">Ustawienia</h1>
        <p className="text-body">Zarządzaj ustawieniami konta i organizacji</p>
      </div>

      {/* User Profile */}
      <SettingsSection
        icon={User}
        title="Mój profil"
        description="Dane osobowe i kontaktowe"
      >
        <div className="space-y-4">
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
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon komórkowy</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+48 600 000 000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkedin">Profil LinkedIn (URL)</Label>
            <Input
              id="linkedin"
              type="url"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="https://linkedin.com/in/jankowalski"
            />
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

      {/* Password Change */}
      <SettingsSection
        icon={Lock}
        title="Zmiana hasła"
        description="Zaktualizuj hasło do swojego konta"
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
          >
            <Lock className="h-4 w-4 mr-2" />
            {passwordSaving ? "Zmieniam…" : "Zmień hasło"}
          </Button>
        </div>
      </SettingsSection>

      {/* Organization */}
      <SettingsSection
        icon={Building2}
        title="Organizacja"
        description={isAdmin ? "Informacje o Twojej organizacji" : "Dane organizacji (tylko odczyt)"}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Nazwa organizacji</Label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={!isAdmin}
              placeholder="Nazwa firmy"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-address">Adres</Label>
            <Input
              id="org-address"
              value={orgAddress}
              onChange={(e) => setOrgAddress(e.target.value)}
              disabled={!isAdmin}
              placeholder="ul. Przykładowa 1, 00-001 Warszawa"
            />
          </div>
          {orgMsg && (
            <p className={cn("text-sm", orgMsg.type === "success" ? "text-green-600" : "text-destructive")}>
              {orgMsg.text}
            </p>
          )}
          {isAdmin && (
            <Button variant="hero" onClick={handleOrgSave} disabled={orgSaving}>
              <Save className="h-4 w-4 mr-2" />
              {orgSaving ? "Zapisywanie…" : "Zapisz organizację"}
            </Button>
          )}
        </div>
      </SettingsSection>

      {/* Talent Import Section */}
      <SettingsSection
        icon={Sparkles}
        title="Moje talenty Gallup"
        description="Importuj lub wprowadź swój profil talentowy"
      >
        <div className="space-y-4">
          {myTalents.length > 0 ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {myTalents.slice(0, 10).map((userTalent) => {
                  const talent = GALLUP_TALENTS.find(t => t.id === userTalent.talentId);
                  if (!talent) return null;

                  const isTop5 = userTalent.rank <= 5;

                  return (
                    <div
                      key={talent.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg",
                        isTop5 ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold",
                        isTop5 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {userTalent.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{talent.namePl}</p>
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
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <p className="font-medium">Brak zaimportowanych talentów</p>
                <p className="text-sm text-muted-foreground">
                  Zaimportuj swój raport Gallup lub wprowadź talenty ręcznie
                </p>
              </div>
              <Button
                variant="hero"
                onClick={() => setTalentImportOpen(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Importuj talenty
              </Button>
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Team management */}
      <SettingsSection
        icon={Users}
        title="Zarządzanie zespołem"
        description="Role i uprawnienia w zespole"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Administratorzy</p>
              <p className="text-sm text-muted-foreground">
                Pełny dostęp do wszystkich funkcji
              </p>
            </div>
            <span className="text-sm text-muted-foreground">1 osoba</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Menedżerowie</p>
              <p className="text-sm text-muted-foreground">
                Zarządzanie zespołem i raportami
              </p>
            </div>
            <span className="text-sm text-muted-foreground">2 osoby</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">Użytkownicy</p>
              <p className="text-sm text-muted-foreground">
                Podstawowy dostęp do profili
              </p>
            </div>
            <span className="text-sm text-muted-foreground">3 osoby</span>
          </div>
          <Button variant="outline" className="w-full">
            Zarządzaj użytkownikami
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection
        icon={Bell}
        title="Powiadomienia"
        description="Ustawienia powiadomień i alertów"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dzienne wskazówki</p>
              <p className="text-sm text-muted-foreground">
                Otrzymuj codzienną wskazówkę rano
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Przypomnienia o spotkaniach</p>
              <p className="text-sm text-muted-foreground">
                Briefing przed spotkaniami 1:1
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Tygodniowe podsumowanie</p>
              <p className="text-sm text-muted-foreground">
                Raport aktywności zespołu
              </p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Powiadomienia email</p>
              <p className="text-sm text-muted-foreground">
                Otrzymuj alerty na email
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </SettingsSection>

      {/* Privacy */}
      <SettingsSection
        icon={Shield}
        title="Prywatność i bezpieczeństwo"
        description="Ustawienia prywatności danych"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Widoczność profilu</p>
              <p className="text-sm text-muted-foreground">
                Zarządzaj widocznością swojego profilu
              </p>
            </div>
            <Button variant="outline" size="sm">
              Zmień
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                Uwierzytelnianie dwuskładnikowe
              </p>
              <p className="text-sm text-muted-foreground">
                Dodatkowa warstwa bezpieczeństwa
              </p>
            </div>
            <Switch />
          </div>
          <Button variant="outline" className="w-full">
            Eksportuj dane
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </SettingsSection>

      {/* Extensions - Post MVP */}
      <div className="space-y-4">
        <h3 className="text-title text-muted-foreground flex items-center gap-2">
          Rozszerzenia <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-bold">WKRÓTCE</span>
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-dashed bg-muted/30 p-6 opacity-60">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-muted p-2">
                <Globe className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">
                Integracja z kalendarzem
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Automatyczne briefing przed spotkaniami
            </p>
          </div>

          <div className="rounded-2xl border border-dashed bg-muted/30 p-6 opacity-60">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-muted p-2">
                <Palette className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">Zdrowie organizacji</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Widok heatmapy dla całej firmy
            </p>
          </div>
        </div>
      </div>

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
