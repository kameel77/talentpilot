"use client";

import { useState } from "react";
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
} from "lucide-react";
import { SettingsSection } from "@/components/dashboard/SettingsSection";
import { GALLUP_TALENTS } from "@/data/gallupTalents";
import { UserTalent } from "@/types/talent";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [talentImportOpen, setTalentImportOpen] = useState(false);
  const [myTalents, setMyTalents] = useState<UserTalent[]>([]);

  const handleTalentsSave = (talents: UserTalent[]) => {
    setMyTalents(talents);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-headline">Ustawienia</h1>
        <p className="text-body">Zarządzaj ustawieniami konta i organizacji</p>
      </div>

      {/* Organization */}
      <SettingsSection
        icon={Building2}
        title="Organizacja"
        description="Informacje o Twojej organizacji"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Nazwa organizacji</Label>
            <Input id="org-name" defaultValue="TechCorp Polska" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-domain">Domena email</Label>
            <Input id="org-domain" defaultValue="techcorp.pl" />
          </div>
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

      {/* Save button */}
      <div className="flex justify-end">
        <Button variant="hero" size="lg" className="px-12 shadow-soft-xl">
          <Save className="h-5 w-5 mr-3" />
          Zapisz zmiany
        </Button>
      </div>

      {/* Talent Import Dialog */}
      <TalentImportDialog
        open={talentImportOpen}
        onOpenChange={setTalentImportOpen}
        onSave={handleTalentsSave}
        initialTalents={myTalents}
        memberName="Moje talenty"
      />
    </div>
  );
}
