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
  Mail,
  Phone,
  BadgeCheck,
} from "lucide-react";
import { cn, isPlaceholderEmail } from "@/lib/utils";
import { GALLUP_TALENTS, DOMAIN_CSS_KEY, GallupDomain } from "@/lib/gallup-data";

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
  job_title_en: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  talents: TalentItem[] | null;
  superpowers: string | null;
  motivators: string | null;
  blockers: string | null;
  feedback_style: string | null;
  superpowers_en: string | null;
  motivators_en: string | null;
  blockers_en: string | null;
  feedback_style_en: string | null;
  gallup_certified: boolean;
  gallup_profile_url: string | null;
}

const DOMAIN_LABEL: Record<string, { pl: string; en: string }> = {
  executing:             { pl: "Wykonywanie", en: "Executing" },
  influencing:           { pl: "Wpływ", en: "Influencing" },
  relationship_building: { pl: "Relacje", en: "Relationship Building" },
  strategic_thinking:    { pl: "Strategia", en: "Strategic Thinking" },
};

const T = {
  pl: {
    notFound: "Nie znaleziono wizytówki",
    notFoundDesc: "Ten link jest nieaktywny lub wygasł.",
    backTo: "Wróć do TalentPilot →",
    bizCard: "Wizytówka talentów",
    topTalents: (n: number) => `Top ${n} talentów Gallup`,
    manualTitle: "Instrukcja obsługi",
    superpowers: "Moje mocne strony",
    motivators: "Motywatory",
    blockers: "Blokady",
    feedback: "Jak mi dawać feedback",
    emptyManual: "Właściciel profilu nie uzupełnił jeszcze instrukcji obsługi.",
    ctaBadge: "Odkryj swoje talenty",
    ctaTitle1: "A jakie są ",
    ctaTitle2: "Twoje",
    ctaTitle3: " mocne strony?",
    ctaDesc: "TalentPilot pomaga odkryć naturalne talenty i przekuć je w lepszą współpracę z zespołem. Stwórz swoją własną wizytówkę — tak jak ta.",
    ctaButton: "Sprawdź TalentPilot",
    benefit1Title: "Poznaj swój profil talentów",
    benefit1Desc: "Odkryj co robisz naturalnie najlepiej i jak to wykorzystać w pracy.",
    benefit2Title: "Współpracuj lepiej z zespołem",
    benefit2Desc: "Stwórz wizytówkę i pomóż innym zrozumieć jak z Tobą pracować.",
    benefit3Title: "Porównaj talenty 1:1",
    benefit3Desc: "AI pokaże synergie z innymi i wskaże jak je efektywnie wykorzystać.",
    footerText: "TalentPilot — Manager Copilot oparty na CliftonStrengths",
    gallupCertified: "Certyfikowany coach Gallup CliftonStrengths",
  },
  en: {
    notFound: "Profile not found",
    notFoundDesc: "This link is inactive or has expired.",
    backTo: "Back to TalentPilot →",
    bizCard: "Talent Profile",
    topTalents: (n: number) => `Top ${n} CliftonStrengths`,
    manualTitle: "User Manual",
    superpowers: "My Superpowers",
    motivators: "Motivators",
    blockers: "Blockers",
    feedback: "How to give me feedback",
    emptyManual: "The profile owner hasn't filled out their user manual yet.",
    ctaBadge: "Discover your talents",
    ctaTitle1: "What are ",
    ctaTitle2: "your",
    ctaTitle3: " superpowers?",
    ctaDesc: "TalentPilot helps you discover natural talents and turn them into better teamwork. Create your own profile — just like this one.",
    ctaButton: "Check out TalentPilot",
    benefit1Title: "Know your talent profile",
    benefit1Desc: "Discover what you naturally do best and how to use it at work.",
    benefit2Title: "Work better with your team",
    benefit2Desc: "Create a profile and help others understand how to work with you.",
    benefit3Title: "Compare talents 1:1",
    benefit3Desc: "AI will show synergies with others and how to use them effectively.",
    footerText: "TalentPilot — Manager Copilot based on CliftonStrengths",
    gallupCertified: "Certified Gallup CliftonStrengths Coach",
  }
};

export default function WizytowkaPage() {
  const params = useParams();
  const token = params?.token as string;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lang, setLang] = useState<"pl" | "en">("pl");

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
    const t = T[lang];
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 px-4 text-center">
        <div className="text-6xl">🔍</div>
        <h1 className="text-xl font-bold text-slate-800">{t.notFound}</h1>
        <p className="text-slate-500 text-sm">{t.notFoundDesc}</p>
        <a href="https://talentpilot.io" className="text-sm text-indigo-600 hover:underline font-medium">
          {t.backTo}
        </a>
      </div>
    );
  }

  const t = T[lang];
  const initials = profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const hasManual = 
    (profile.superpowers || profile.motivators || profile.blockers || profile.feedback_style) ||
    (profile.superpowers_en || profile.motivators_en || profile.blockers_en || profile.feedback_style_en);

  const displaySuperpowers = lang === "en" ? (profile.superpowers_en || profile.superpowers) : profile.superpowers;
  const displayMotivators = lang === "en" ? (profile.motivators_en || profile.motivators) : profile.motivators;
  const displayBlockers = lang === "en" ? (profile.blockers_en || profile.blockers) : profile.blockers;
  const displayFeedback = lang === "en" ? (profile.feedback_style_en || profile.feedback_style) : profile.feedback_style;
  const displayJobTitle = lang === "en" ? (profile.job_title_en || profile.job_title) : profile.job_title;

  // Count talents per domain (all visible)
  const domainCount = profile.talents?.reduce((acc, t) => {
    const canonicalDomain = GALLUP_TALENTS.find(x => x.code === t.code)?.domain || "executing";
    acc[canonicalDomain] = (acc[canonicalDomain] ?? 0) + 1;
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
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline-block">{t.bizCard}</span>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setLang("pl")}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider",
                  lang === "pl" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                PL
              </button>
              <button
                onClick={() => setLang("en")}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider",
                  lang === "en" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                EN
              </button>
            </div>
          </div>
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
              <div className="h-28 bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500 relative" />

              {/* Avatar + info */}
              <div className="px-5 sm:px-6 pt-0 pb-6 -mt-12 relative z-10 flex flex-col items-center sm:items-start text-center sm:text-left">
                <div
                  className={cn(
                    "h-24 w-24 rounded-full overflow-hidden bg-indigo-600 flex items-center justify-center",
                    "border-4 border-white shadow-md shrink-0 relative"
                  )}
                >
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover object-center" />
                  ) : (
                    <span className="text-white font-bold text-2xl">{initials}</span>
                  )}
                </div>

                <h1 className="mt-3 text-2xl font-bold text-slate-900 leading-tight">{profile.full_name}</h1>
                {displayJobTitle && (
                  <p className="text-[14px] font-medium text-slate-500 mt-1">{displayJobTitle}</p>
                )}
                {profile.gallup_certified && (
                  profile.gallup_profile_url ? (
                    <a
                      href={profile.gallup_profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-100 transition"
                    >
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {t.gallupCertified}
                    </a>
                  ) : (
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-600">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {t.gallupCertified}
                    </span>
                  )
                )}

                {/* Contact details */}
                {((profile.email && !isPlaceholderEmail(profile.email)) || profile.phone || profile.linkedin_url) && (
                  <div className="mt-5 space-y-2.5 w-full">
                    {profile.email && !isPlaceholderEmail(profile.email) && (
                      <a
                        href={`mailto:${profile.email}`}
                        title={profile.email}
                        className="flex items-center justify-center sm:justify-start gap-3 text-[14px] font-medium text-slate-600 hover:text-indigo-600 transition bg-slate-50 hover:bg-indigo-50 rounded-xl p-3 border border-slate-100"
                      >
                        <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="truncate">{profile.email}</span>
                      </a>
                    )}
                    {profile.phone && (
                      <a
                        href={`tel:${profile.phone}`}
                        title={profile.phone}
                        className="flex items-center justify-center sm:justify-start gap-3 text-[14px] font-medium text-slate-600 hover:text-indigo-600 transition bg-slate-50 hover:bg-indigo-50 rounded-xl p-3 border border-slate-100"
                      >
                        <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="truncate">{profile.phone}</span>
                      </a>
                    )}
                    {profile.linkedin_url && (
                      <a
                        href={profile.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={profile.linkedin_url}
                        className="flex items-center justify-center sm:justify-start gap-3 text-[14px] font-medium text-slate-600 hover:text-[#0A66C2] transition bg-slate-50 hover:bg-[#0A66C2]/10 rounded-xl p-3 border border-slate-100"
                      >
                        <Linkedin className="h-4 w-4 text-[#0A66C2] shrink-0" />
                        <span className="truncate">LinkedIn</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Talents card */}
            {profile.talents && profile.talents.length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  <h2 className="font-semibold text-slate-800 text-sm">{t.topTalents(profile.talents.length)}</h2>
                </div>

                <div className="space-y-2">
                  {profile.talents.map((tItem) => {
                    const canonicalDomain = GALLUP_TALENTS.find(x => x.code === tItem.code)?.domain || "executing";
                    const cssKey = DOMAIN_CSS_KEY[canonicalDomain as GallupDomain] || "executing";
                    return (
                    <div key={tItem.rank} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span
                        className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0"
                        style={{ backgroundColor: `var(--color-domain-${cssKey})` }}
                      >
                        {tItem.rank}
                      </span>
                      <span className="flex-1 text-[14px] font-semibold text-slate-800 leading-tight truncate">
                        {lang === "en" ? (tItem.name_en || tItem.name_pl) : tItem.name_pl}
                      </span>
                      <span className={cn(
                        "text-[9px] sm:text-[10px] uppercase tracking-wider px-2 py-1 rounded-md font-bold border shrink-0 whitespace-nowrap",
                        `domain-${cssKey}`
                      )}>
                        {DOMAIN_LABEL[canonicalDomain]?.[lang] ?? canonicalDomain}
                      </span>
                    </div>
                  )})}
                </div>

                {/* Domain distribution */}
                {Object.keys(domainCount).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-2">
                    {Object.entries(domainCount).map(([domain, count]) => {
                      const cssKey = DOMAIN_CSS_KEY[domain as GallupDomain] || "executing";
                      return (
                      <div key={domain} className="flex items-center gap-1.5">
                        <span 
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: `var(--color-domain-${cssKey})` }}
                        />
                        <span className="text-xs text-slate-500 truncate">
                          {DOMAIN_LABEL[domain]?.[lang] ?? domain}
                          <span className="font-semibold text-slate-700 ml-1">×{count}</span>
                        </span>
                      </div>
                    )})}
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
                    {t.manualTitle}
                  </span>
                  <div className="h-px flex-1 bg-slate-300" />
                </div>

                {/* Superpowers — full width */}
                {displaySuperpowers && (
                  <ManualCard
                    icon={<Zap className="h-4 w-4" />}
                    iconClass="bg-amber-50 text-amber-600"
                    title={t.superpowers}
                    text={displaySuperpowers}
                  />
                )}

                {/* Motivators + Blockers — side by side */}
                {(displayMotivators || displayBlockers) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {displayMotivators && (
                      <ManualCard
                        icon={<Smile className="h-4 w-4" />}
                        iconClass="bg-emerald-50 text-emerald-600"
                        title={t.motivators}
                        text={displayMotivators}
                      />
                    )}
                    {displayBlockers && (
                      <ManualCard
                        icon={<Shield className="h-4 w-4" />}
                        iconClass="bg-rose-50 text-rose-600"
                        title={t.blockers}
                        text={displayBlockers}
                      />
                    )}
                  </div>
                )}

                {/* Feedback style — full width */}
                {displayFeedback && (
                  <ManualCard
                    icon={<MessageSquare className="h-4 w-4" />}
                    iconClass="bg-blue-50 text-blue-600"
                    title={t.feedback}
                    text={displayFeedback}
                  />
                )}
              </>
            ) : (
              /* Empty state for right column */
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-8 text-center">
                <MessageSquare className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">{t.emptyManual}</p>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════ CTA — below grid ════════════════ */}
        <div className="mt-8 rounded-2xl overflow-hidden shadow-sm border border-slate-200">
          <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-600 px-6 py-10 sm:px-10 sm:py-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">

              {/* Copy */}
              <div className="text-white space-y-5 text-center md:text-left flex flex-col items-center md:items-start">
                <div className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                  <Sparkles className="h-3 w-3" />
                  {t.ctaBadge}
                </div>
                <h3 className="text-3xl sm:text-4xl font-extrabold leading-tight">
                  {t.ctaTitle1}<span className="text-indigo-200">{t.ctaTitle2}</span>{t.ctaTitle3}
                </h3>
                <p className="text-indigo-100 text-[15px] leading-relaxed max-w-md mx-auto md:mx-0">
                  {t.ctaDesc}
                </p>
                <a
                  href="https://talentpilot.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full sm:w-auto gap-2 bg-white text-indigo-700 font-bold text-[15px] px-6 py-3.5 rounded-xl hover:bg-indigo-50 transition shadow-lg mt-2"
                >
                  {t.ctaButton}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              {/* Benefits */}
              <div className="space-y-3">
                {[
                  { icon: <Brain className="h-5 w-5" />, title: t.benefit1Title, desc: t.benefit1Desc },
                  { icon: <Users className="h-5 w-5" />, title: t.benefit2Title, desc: t.benefit2Desc },
                  { icon: <BarChart3 className="h-5 w-5" />, title: t.benefit3Title, desc: t.benefit3Desc },
                ].map((b, i) => (
                  <div key={i} className="flex gap-4 bg-white/10 rounded-2xl p-4 sm:p-5 border border-white/5 backdrop-blur-sm">
                    <div className="text-indigo-200 mt-0.5 shrink-0">{b.icon}</div>
                    <div>
                      <p className="text-white font-bold text-[15px] leading-tight">{b.title}</p>
                      <p className="text-indigo-200 text-[13px] mt-1.5 leading-relaxed">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer strip */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 sm:px-8 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="h-8 w-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-[11px] shrink-0 shadow-sm">TP</div>
              <span className="text-[14px] text-slate-500 font-medium">{t.footerText}</span>
            </div>
            <a
              href="https://talentpilot.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[14px] text-indigo-600 font-bold hover:text-indigo-700 transition shrink-0"
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
      <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line break-words">{text}</p>
    </div>
  );
}
