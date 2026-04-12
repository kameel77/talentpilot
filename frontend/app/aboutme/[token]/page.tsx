"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DomainBadge } from "@/components/ui/DomainBadge";
import {
  Sparkles,
  Zap,
  Shield,
  MessageSquare,
  Linkedin,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface TalentItem {
  rank: number;
  code: string;
  name_pl: string;
  name_en: string | null;
  domain: string;
}

interface PublicProfile {
  full_name: string;
  job_title: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  talents: TalentItem[] | null;
  superpowers: string | null;
  motivators: string | null;
  blockers: string | null;
  feedback_style: string | null;
}

const DOMAIN_COLORS: Record<string, string> = {
  executing: "bg-amber-100 text-amber-800",
  influencing: "bg-purple-100 text-purple-800",
  relationship_building: "bg-emerald-100 text-emerald-800",
  strategic_thinking: "bg-blue-100 text-blue-800",
};

const DOMAIN_LABELS: Record<string, string> = {
  executing: "Realizowanie",
  influencing: "Wywieranie wpływu",
  relationship_building: "Budowanie relacji",
  strategic_thinking: "Myślenie strategiczne",
};

function Section({
  icon: Icon,
  title,
  children,
  color = "blue",
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("rounded-lg p-2", colorMap[color] ?? colorMap.blue)}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function WizytowkaPage() {
  const params = useParams();
  const token = params?.token as string;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/public/${token}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setProfile(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <div className="text-5xl">🔍</div>
        <h1 className="text-xl font-bold text-slate-800">Nie znaleziono wizytówki</h1>
        <p className="text-slate-500 text-sm">Ten link jest nieaktywny lub wygasł.</p>
      </div>
    );
  }

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const hasUserManual =
    profile.superpowers || profile.motivators || profile.blockers || profile.feedback_style;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Header bar */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">
            TP
          </div>
          <span className="font-bold text-slate-700 text-sm">TalentPilot</span>
        </div>
        <span className="text-xs text-slate-400">Wizytówka talentów</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* Hero card */}
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-blue-600 to-blue-500" />
          <div className="px-6 pb-6 -mt-10">
            <div className="h-20 w-20 rounded-2xl overflow-hidden bg-blue-600 flex items-center justify-center border-4 border-white shadow-md">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-white font-bold text-2xl">{initials}</span>
              )}
            </div>
            <div className="mt-3">
              <h1 className="text-2xl font-bold text-slate-900">{profile.full_name}</h1>
              {profile.job_title && (
                <p className="text-slate-500 mt-0.5">{profile.job_title}</p>
              )}
              {profile.linkedin_url && (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-sm text-blue-600 hover:underline"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Top 5 Talents */}
        {profile.talents && profile.talents.length > 0 && (
          <Section icon={Sparkles} title="Top 5 talentów Gallup" color="blue">
            <div className="space-y-2">
              {profile.talents.slice(0, 5).map((t) => (
                <div
                  key={t.rank}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50"
                >
                  <div className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {t.rank}
                  </div>
                  <span className="font-medium text-slate-800 flex-1">{t.name_pl}</span>
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      DOMAIN_COLORS[t.domain] ?? "bg-slate-100 text-slate-600"
                    )}
                  >
                    {DOMAIN_LABELS[t.domain] ?? t.domain}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* User Manual */}
        {hasUserManual && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 px-1">
              Instrukcja obsługi
            </h2>

            {profile.superpowers && (
              <Section icon={Zap} title="Moje mocne strony" color="amber">
                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                  {profile.superpowers}
                </p>
              </Section>
            )}

            {profile.motivators && (
              <Section icon={Sparkles} title="Wyzwalacze i motywatory" color="emerald">
                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                  {profile.motivators}
                </p>
              </Section>
            )}

            {profile.blockers && (
              <Section icon={Shield} title="Blokady i ograniczenia" color="purple">
                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                  {profile.blockers}
                </p>
              </Section>
            )}

            {profile.feedback_style && (
              <Section icon={MessageSquare} title="Jak mi dawać feedback" color="blue">
                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                  {profile.feedback_style}
                </p>
              </Section>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 pt-4">
          Wygenerowano przez{" "}
          <span className="font-semibold text-slate-500">TalentPilot</span>
        </p>
      </div>
    </div>
  );
}
