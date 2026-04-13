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
  ThumbsUp,
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

const DOMAIN_COLORS: Record<string, { badge: string; dot: string; rank: string }> = {
  executing:            { badge: "bg-amber-100 text-amber-800 border-amber-200",     dot: "bg-amber-500",   rank: "bg-amber-500" },
  influencing:          { badge: "bg-purple-100 text-purple-800 border-purple-200",   dot: "bg-purple-500",  rank: "bg-purple-500" },
  relationship_building:{ badge: "bg-emerald-100 text-emerald-800 border-emerald-200",dot: "bg-emerald-500", rank: "bg-emerald-500" },
  strategic_thinking:   { badge: "bg-blue-100 text-blue-800 border-blue-200",         dot: "bg-blue-500",    rank: "bg-blue-500" },
};

const DOMAIN_LABELS: Record<string, string> = {
  executing: "Realizowanie",
  influencing: "Wpływ",
  relationship_building: "Relacje",
  strategic_thinking: "Strategia",
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
      .then((data) => { if (data) setProfile(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 px-4">
        <div className="text-6xl">🔍</div>
        <h1 className="text-xl font-bold text-slate-800">Nie znaleziono wizytówki</h1>
        <p className="text-slate-500 text-sm text-center">Ten link jest nieaktywny lub wygasł.</p>
        <a
          href="https://talentpilot.io"
          className="mt-2 text-sm text-indigo-600 hover:underline font-medium"
        >
          Wróć do TalentPilot →
        </a>
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

  const domainGroups = profile.talents?.reduce((acc, t) => {
    if (!acc[t.domain]) acc[t.domain] = [];
    acc[t.domain].push(t);
    return acc;
  }, {} as Record<string, TalentItem[]>) ?? {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100">

      {/* Top bar */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <a href="https://talentpilot.io" className="flex items-center gap-2" target="_blank" rel="noopener noreferrer">
            <div className="h-6 w-6 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold text-[10px] shrink-0">
              TP
            </div>
            <span className="font-bold text-slate-700 text-sm">TalentPilot</span>
          </a>
          <span className="text-xs text-slate-400 hidden sm:block">Wizytówka talentów</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Hero — full width, compact */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden mb-6">
          {/* Cover gradient */}
          <div className="h-24 sm:h-32 bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500" />

          <div className="px-6 pb-6 -mt-12 sm:-mt-14">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              {/* Avatar + name */}
              <div className="flex items-end gap-4">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden bg-indigo-600 flex items-center justify-center border-4 border-white shadow-md shrink-0">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-2xl sm:text-3xl">{initials}</span>
                  )}
                </div>
                <div className="pb-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{profile.full_name}</h1>
                  {profile.job_title && (
                    <p className="text-slate-500 text-sm mt-0.5">{profile.job_title}</p>
                  )}
                </div>
              </div>

              {/* LinkedIn */}
              {profile.linkedin_url && (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-end sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition"
                >
                  <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                  LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>

        {/* 2-column grid on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT COLUMN — sticky sidebar */}
          <div className="lg:col-span-2 space-y-5">

            {/* Top 5 Talents */}
            {profile.talents && profile.talents.length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="rounded-lg bg-indigo-50 p-1.5 text-indigo-600">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h2 className="font-semibold text-slate-800">Top 5 talentów Gallup</h2>
                </div>

                <div className="space-y-2">
                  {profile.talents.slice(0, 5).map((t) => {
                    const dc = DOMAIN_COLORS[t.domain];
                    return (
                      <div
                        key={t.rank}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition"
                      >
                        <div
                          className={cn(
                            "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0",
                            dc?.rank ?? "bg-indigo-500"
                          )}
                        >
                          {t.rank}
                        </div>
                        <span className="font-medium text-slate-800 flex-1 text-sm">{t.name_pl}</span>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium border",
                            dc?.badge ?? "bg-slate-100 text-slate-600 border-slate-200"
                          )}
                        >
                          {DOMAIN_LABELS[t.domain] ?? t.domain}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Domain legend */}
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
                  {Object.entries(domainGroups).map(([domain, items]) => {
                    const dc = DOMAIN_COLORS[domain];
                    return (
                      <div key={domain} className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full shrink-0", dc?.dot ?? "bg-slate-400")} />
                        <span className="text-xs text-slate-500 truncate">
                          {DOMAIN_LABELS[domain] ?? domain}
                          <span className="ml-1 font-semibold text-slate-700">×{items.length}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* "Jak ze mną współpracować" teaser — only on desktop if no manual */}
            {!hasUserManual && (
              <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-5 hidden lg:block">
                <p className="text-sm text-indigo-700 font-medium">Instrukcja obsługi nie jest jeszcze uzupełniona.</p>
                <p className="text-xs text-indigo-500 mt-1">Właściciel profilu może ją dodać w TalentPilot.</p>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN — User Manual */}
          <div className="lg:col-span-3 space-y-4">
            {hasUserManual && (
              <>
                <div className="flex items-center gap-2 px-1">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Instrukcja obsługi</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                {profile.superpowers && (
                  <ManualCard
                    icon={<Zap className="h-4 w-4" />}
                    title="Moje mocne strony"
                    iconClass="bg-amber-50 text-amber-600"
                    text={profile.superpowers}
                  />
                )}

                {(profile.motivators || profile.blockers) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {profile.motivators && (
                      <ManualCard
                        icon={<Smile className="h-4 w-4" />}
                        title="Motywatory"
                        iconClass="bg-emerald-50 text-emerald-600"
                        text={profile.motivators}
                      />
                    )}
                    {profile.blockers && (
                      <ManualCard
                        icon={<Shield className="h-4 w-4" />}
                        title="Blokady"
                        iconClass="bg-rose-50 text-rose-600"
                        text={profile.blockers}
                      />
                    )}
                  </div>
                )}

                {profile.feedback_style && (
                  <ManualCard
                    icon={<MessageSquare className="h-4 w-4" />}
                    title="Jak mi dawać feedback"
                    iconClass="bg-blue-50 text-blue-600"
                    text={profile.feedback_style}
                  />
                )}
              </>
            )}

            {!hasUserManual && (
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-8 text-center">
                <ThumbsUp className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Właściciel profilu nie uzupełnił jeszcze instrukcji obsługi.</p>
              </div>
            )}
          </div>
        </div>

        {/* ─── CTA — "A jakie są Twoje talenty?" ─── */}
        <div className="mt-10 rounded-2xl overflow-hidden border border-indigo-100 shadow-sm">
          {/* Subtle gradient background */}
          <div className="bg-gradient-to-br from-indigo-600 to-blue-600 px-6 py-8 sm:px-10 sm:py-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
              {/* Left: copy */}
              <div className="text-white space-y-4">
                <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                  <Sparkles className="h-3 w-3" />
                  Odkryj swoje talenty
                </div>
                <h3 className="text-2xl font-bold leading-snug">
                  A jakie są <span className="text-indigo-200">Twoje</span> mocne strony?
                </h3>
                <p className="text-indigo-100 text-sm leading-relaxed">
                  TalentPilot pomaga odkryć naturalne talenty i przekuć je w lepszą współpracę z zespołem. Stwórz swoją własną wizytówkę talentów.
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

              {/* Right: benefit bullets */}
              <div className="grid grid-cols-1 gap-3">
                {[
                  {
                    icon: <Brain className="h-5 w-5" />,
                    title: "Poznaj swój profil talentów",
                    desc: "Odkryj co robisz naturalnie najlepiej, zanim zaczniesz nad tym pracować.",
                  },
                  {
                    icon: <Users className="h-5 w-5" />,
                    title: "Współpracuj lepiej z zespołem",
                    desc: "Stwórz wizytówkę i powiedz współpracownikom jak najlepiej z Tobą pracować.",
                  },
                  {
                    icon: <BarChart3 className="h-5 w-5" />,
                    title: "Porównaj talenty 1:1",
                    desc: "Sprawdź synergie i różnice między Tobą a innymi — AI wskaże jak je wykorzystać.",
                  },
                ].map((b, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white/10 rounded-xl p-3.5">
                    <div className="text-indigo-200 mt-0.5 shrink-0">{b.icon}</div>
                    <div>
                      <p className="text-white font-semibold text-sm">{b.title}</p>
                      <p className="text-indigo-200 text-xs mt-0.5 leading-relaxed">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer strip */}
          <div className="bg-white px-6 py-3 flex items-center justify-between border-t border-indigo-100">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-[9px]">TP</div>
              <span className="text-xs text-slate-500 font-medium">TalentPilot — Manager Copilot oparty na CliftonStrengths</span>
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

      </main>
    </div>
  );
}

function ManualCard({
  icon,
  title,
  iconClass,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  iconClass: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 h-full">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn("rounded-lg p-1.5", iconClass)}>{icon}</div>
        <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
      </div>
      <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  );
}
