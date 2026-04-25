/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Sparkles,
  Zap,
  Shield,
  MessageSquare,
  Linkedin,
  Loader2,
  Smile,
  ArrowRight,
  Users,
  BarChart3,
  Brain,
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

const DOMAIN_STYLE: Record<string, { badge: string; ring: string; dot: string }> = {
  executing:             { badge: "bg-amber-100   text-amber-800   border border-amber-200",   ring: "ring-amber-400",   dot: "bg-amber-400"   },
  influencing:           { badge: "bg-purple-100  text-purple-800  border border-purple-200",  ring: "ring-purple-400",  dot: "bg-purple-400"  },
  relationship_building: { badge: "bg-emerald-100 text-emerald-800 border border-emerald-200", ring: "ring-emerald-400", dot: "bg-emerald-400" },
  strategic_thinking:    { badge: "bg-sky-100     text-sky-800     border border-sky-200",     ring: "ring-sky-400",     dot: "bg-sky-400"     },
};

const DOMAIN_LABEL: Record<string, string> = {
  executing:             "Realizowanie",
  influencing:           "Wpływ",
  relationship_building: "Relacje",
  strategic_thinking:    "Strategia",
};

// Rank number pill colour (matches domain)
const RANK_BG: Record<string, string> = {
  executing:             "bg-amber-500",
  influencing:           "bg-purple-500",
  relationship_building: "bg-emerald-500",
  strategic_thinking:    "bg-sky-500",
};

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
      .then((d) => { if (d) setProfile(d); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  /* ── 404 ── */
  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 px-4 text-center">
        <div className="text-6xl">🔍</div>
        <h1 className="text-xl font-bold text-slate-800">Nie znaleziono wizytówki</h1>
        <p className="text-slate-500 text-sm">Ten link jest nieaktywny lub wygasł.</p>
        <a href="https://talentpilot.io" className="text-sm text-indigo-600 hover:underline font-medium">
          Wróć do TalentPilot →
        </a>
      </div>
    );
  }

  const initials = profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const hasManual = profile.superpowers || profile.motivators || profile.blockers || profile.feedback_style;

  // Count talents per domain (all visible)
  const domainCount = profile.talents?.reduce((acc, t) => {
    acc[t.domain] = (acc[t.domain] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Topbar ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-11 flex items-center justify-between">
          <a
            href="https://talentpilot.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5"
          >
            <div className="h-6 w-6 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-[10px]">TP</div>
            <span className="font-semibold text-slate-700 text-sm">TalentPilot</span>
          </a>
          <span className="text-xs text-slate-400">Wizytówka talentów</span>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

          {/* ════════════════ LEFT SIDEBAR ════════════════ */}
          <div className="lg:col-span-2 lg:sticky lg:top-16 space-y-4">

            {/* Profile card */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              {/* Cover */}
              <div className="h-20 bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500" />

              {/* Avatar + info */}
              <div className="px-5 pt-0 pb-5 -mt-9">
                <div
                  className={cn(
                    "h-16 w-16 rounded-xl overflow-hidden bg-indigo-600 flex items-center justify-center",
                    "border-[3px] border-white shadow-md"
                  )}
                >
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-xl">{initials}</span>
                  )}
                </div>

                <h1 className="mt-2.5 text-lg font-bold text-slate-900 leading-tight">{profile.full_name}</h1>
                {profile.job_title && (
                  <p className="text-sm text-slate-500 mt-0.5">{profile.job_title}</p>
                )}

                {profile.linkedin_url && (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 transition"
                  >
                    <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />
                    LinkedIn
                  </a>
                )}
              </div>
            </div>

            {/* Talents card */}
            {profile.talents && profile.talents.length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  <h2 className="font-semibold text-slate-800 text-sm">Top 5 talentów Gallup</h2>
                </div>

                <div className="space-y-1.5">
                  {profile.talents.slice(0, 5).map((t) => (
                    <div key={t.rank} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-slate-50">
                      <span
                        className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0",
                          RANK_BG[t.domain] ?? "bg-indigo-500"
                        )}
                      >
                        {t.rank}
                      </span>
                      <span className="flex-1 text-sm font-medium text-slate-800">{t.name_pl}</span>
                      <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", DOMAIN_STYLE[t.domain]?.badge ?? "bg-slate-100 text-slate-600")}>
                        {DOMAIN_LABEL[t.domain] ?? t.domain}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Domain distribution */}
                {Object.keys(domainCount).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-x-4 gap-y-2">
                    {Object.entries(domainCount).map(([domain, count]) => (
                      <div key={domain} className="flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOMAIN_STYLE[domain]?.dot ?? "bg-slate-400")} />
                        <span className="text-xs text-slate-500 truncate">
                          {DOMAIN_LABEL[domain] ?? domain}
                          <span className="font-semibold text-slate-700 ml-1">×{count}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ════════════════ RIGHT — User Manual ════════════════ */}
          <div className="lg:col-span-3 space-y-4">

            {hasManual ? (
              <>
                {/* Section title */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-300" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                    Instrukcja obsługi
                  </span>
                  <div className="h-px flex-1 bg-slate-300" />
                </div>

                {/* Superpowers — full width */}
                {profile.superpowers && (
                  <ManualCard
                    icon={<Zap className="h-4 w-4" />}
                    iconClass="bg-amber-50 text-amber-600"
                    title="Moje mocne strony"
                    text={profile.superpowers}
                  />
                )}

                {/* Motivators + Blockers — side by side */}
                {(profile.motivators || profile.blockers) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {profile.motivators && (
                      <ManualCard
                        icon={<Smile className="h-4 w-4" />}
                        iconClass="bg-emerald-50 text-emerald-600"
                        title="Motywatory"
                        text={profile.motivators}
                      />
                    )}
                    {profile.blockers && (
                      <ManualCard
                        icon={<Shield className="h-4 w-4" />}
                        iconClass="bg-rose-50 text-rose-600"
                        title="Blokady"
                        text={profile.blockers}
                      />
                    )}
                  </div>
                )}

                {/* Feedback style — full width */}
                {profile.feedback_style && (
                  <ManualCard
                    icon={<MessageSquare className="h-4 w-4" />}
                    iconClass="bg-blue-50 text-blue-600"
                    title="Jak mi dawać feedback"
                    text={profile.feedback_style}
                  />
                )}
              </>
            ) : (
              /* Empty state for right column */
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-8 text-center">
                <MessageSquare className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Właściciel profilu nie uzupełnił jeszcze instrukcji obsługi.</p>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════ CTA — below grid ════════════════ */}
        <div className="mt-8 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-600 px-6 py-8 sm:px-8 sm:py-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">

              {/* Copy */}
              <div className="text-white space-y-4">
                <div className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                  <Sparkles className="h-3 w-3" />
                  Odkryj swoje talenty
                </div>
                <h3 className="text-2xl font-bold leading-snug">
                  A jakie są <span className="text-indigo-200">Twoje</span> mocne strony?
                </h3>
                <p className="text-indigo-100 text-sm leading-relaxed">
                  TalentPilot pomaga odkryć naturalne talenty i przekuć je w lepszą współpracę z zespołem. Stwórz swoją własną wizytówkę — tak jak ta.
                </p>
                <a
                  href="https://talentpilot.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white text-indigo-700 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-indigo-50 transition shadow-sm"
                >
                  Sprawdź TalentPilot
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              {/* Benefits */}
              <div className="space-y-3">
                {[
                  { icon: <Brain className="h-4 w-4" />, title: "Poznaj swój profil talentów", desc: "Odkryj co robisz naturalnie najlepiej i jak to wykorzystać w pracy." },
                  { icon: <Users className="h-4 w-4" />, title: "Współpracuj lepiej z zespołem", desc: "Stwórz wizytówkę i pomóż innym zrozumieć jak z Tobą pracować." },
                  { icon: <BarChart3 className="h-4 w-4" />, title: "Porównaj talenty 1:1", desc: "AI pokaże synergie z innymi i wskaże jak je efektywnie wykorzystać." },
                ].map((b, i) => (
                  <div key={i} className="flex gap-3 bg-white/10 rounded-xl p-3">
                    <div className="text-indigo-200 mt-0.5 shrink-0">{b.icon}</div>
                    <div>
                      <p className="text-white font-semibold text-xs">{b.title}</p>
                      <p className="text-indigo-200 text-xs mt-0.5 leading-relaxed">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer strip */}
          <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-[9px]">TP</div>
              <span className="text-xs text-slate-500">TalentPilot — Manager Copilot oparty na CliftonStrengths</span>
            </div>
            <a
              href="https://talentpilot.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              talentpilot.io →
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── ManualCard ── */
function ManualCard({
  icon,
  iconClass,
  title,
  text,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 h-full">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn("rounded-lg p-1.5 shrink-0", iconClass)}>{icon}</div>
        <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
      </div>
      <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  );
}
