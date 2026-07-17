# Team Analytics Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port full team analytics from talentpilot-team into talentpilot's team view (rank list, heatmap, weaknesses, SPOF, member profiles), add 3 new coach statistics, simplify the members list with per-member report upload.

**Architecture:** Frontend-only change. All algorithms live in `frontend/lib/team-algorithms.ts` (already contains the ported functions; we add 3 new pure functions). `MatrixDashboard` stays the composer: it computes rank maps once and passes data to new small presentational components. The team page renders analytics always-on and a collapsed-by-default simplified members table.

**Tech Stack:** Next.js (App Router, TypeScript), Tailwind, recharts, next-intl (messages/pl.json + en.json), lucide-react. No new dependencies. No backend changes.

**Spec:** `docs/superpowers/specs/2026-07-17-team-analytics-port-design.md`

## Global Constraints

- Branch: `feature/team-analytics-port` (already created, contains the spec commit).
- Working dir for all npm commands: `frontend/`.
- Top N convention: **Top 15** (toggles show "Top 5" / "Top 15"; literal labels, no i18n keys).
- Risk sections (weaknesses, SPOF, resilience, complementary pairs) render only when `canSeeRisks === true`.
- Per-member report upload renders only for roles `coach | admin | manager` (backend `save-talents` returns 403 for role `user` acting on others).
- Code and comments in English; UI texts in both `messages/pl.json` and `messages/en.json`.
- Match existing Tailwind style of `MatrixDashboard.tsx`: cards are `bg-white rounded-2xl border border-slate-200 shadow-sm p-6`.
- No test infra exists (`package.json` has only dev/build/start/lint). Algorithm verification uses a throwaway `npx tsx` script in the scratchpad (never committed). Final gate: `npm run lint` + `npm run build` pass.
- Existing exports you will reuse from `@/lib/gallup-data`: `GALLUP_TALENTS` (`{code, en, pl, en_desc?, pl_desc?, domain}`), `getDomainStyle(domain, opacity?)`, `DOMAIN_LABELS` (`{en, pl}` per domain), `GallupDomain`, `getTalentsByDomain`.
- Existing exports from `@/lib/team-algorithms`: `teamTalentRanks(membersRankMaps, talentCodes)`, `teamDomainScores`, `findTeamWeaknesses(membersRankMaps, talentCodes, threshold=0.3)`, `findSPOF(membersRankMaps, talentCodes)`, `checkDomainSpecialist(memberRankMap, talentCodes, talentDomainMap)`.
- `MemberRankMap` = `Record<string, number>` (talentCode → rank 1..34).

---

### Task 1: New algorithm functions

**Files:**
- Modify: `frontend/lib/team-algorithms.ts` (append at end of file)

**Interfaces:**
- Consumes: existing `MemberRankMap`, `teamTalentRanks` from the same file.
- Produces (later tasks import these from `@/lib/team-algorithms`):
  - `uniqueContributions(membersRankMaps: MemberRankMap[], talentCodes: string[]): UniqueContributionResult[]`
  - `complementaryPairs(membersRankMaps: MemberRankMap[], talentCodes: string[]): ComplementaryPairResult[]`
  - `teamResilience(membersRankMaps: MemberRankMap[], talentCodes: string[]): TeamResilienceResult`

- [ ] **Step 1: Append the three functions + interfaces**

Append to `frontend/lib/team-algorithms.ts`:

```typescript
// ─── 9. Unique Contributions ────────────────────────────────────────────

export interface UniqueContributionResult {
    memberIndex: number;                                   // index in membersRankMaps
    talents: { talentCode: string; rank: number }[];       // sorted by rank asc
}

/**
 * For each member: talents they hold in their Top 10 that NO other member
 * has in their Top 15. Positive framing of SPOF — "what X uniquely brings".
 */
export function uniqueContributions(
    membersRankMaps: MemberRankMap[],
    talentCodes: string[],
): UniqueContributionResult[] {
    return membersRankMaps.map((memberMap, i) => {
        const talents: { talentCode: string; rank: number }[] = [];
        for (const talent of talentCodes) {
            const rank = memberMap[talent];
            if (rank === undefined || rank > 10) continue;
            const someoneElseHasIt = membersRankMaps.some((other, j) => {
                if (j === i) return false;
                const r = other[talent];
                return r !== undefined && r <= 15;
            });
            if (!someoneElseHasIt) talents.push({ talentCode: talent, rank });
        }
        talents.sort((a, b) => a.rank - b.rank);
        return { memberIndex: i, talents };
    });
}

// ─── 10. Complementary Pairs ────────────────────────────────────────────

export interface PairCoverage {
    talentCode: string;
    coveringRank: number;    // rank in the covering member's profile (<=10)
    coveredRank: number;     // rank in the covered member's profile (>=30)
}

export interface ComplementaryPairResult {
    memberA: number;         // index in membersRankMaps, memberA < memberB
    memberB: number;
    aCoversB: PairCoverage[];  // A strong (Top 10) where B is Bottom 5
    bCoversA: PairCoverage[];  // B strong (Top 10) where A is Bottom 5
    strength: number;          // aCoversB.length + bCoversA.length
}

/**
 * Pairs of members where one's Top 10 covers the other's Bottom 5 (rank>=30).
 * Sorted by strength desc; pairs with strength 0 are omitted.
 */
export function complementaryPairs(
    membersRankMaps: MemberRankMap[],
    talentCodes: string[],
): ComplementaryPairResult[] {
    const results: ComplementaryPairResult[] = [];
    for (let a = 0; a < membersRankMaps.length; a++) {
        for (let b = a + 1; b < membersRankMaps.length; b++) {
            const aCoversB: PairCoverage[] = [];
            const bCoversA: PairCoverage[] = [];
            for (const talent of talentCodes) {
                const ra = membersRankMaps[a][talent];
                const rb = membersRankMaps[b][talent];
                if (ra === undefined || rb === undefined) continue;
                if (ra <= 10 && rb >= 30) {
                    aCoversB.push({ talentCode: talent, coveringRank: ra, coveredRank: rb });
                }
                if (rb <= 10 && ra >= 30) {
                    bCoversA.push({ talentCode: talent, coveringRank: rb, coveredRank: ra });
                }
            }
            const strength = aCoversB.length + bCoversA.length;
            if (strength > 0) {
                results.push({ memberA: a, memberB: b, aCoversB, bCoversA, strength });
            }
        }
    }
    return results.sort((x, y) => y.strength - x.strength);
}

// ─── 11. Team Resilience ────────────────────────────────────────────────

export interface TeamResilienceResult {
    percentage: number;      // 0-100, rounded
    coveredCount: number;    // team Top 15 talents carried by >=2 members in their Top 10
    totalCount: number;      // number of talents in team Top 15
}

/**
 * Share of the team's Top 15 talents (by teamTalentRanks) that at least
 * TWO members carry in their personal Top 10. Complements SPOF as one KPI.
 */
export function teamResilience(
    membersRankMaps: MemberRankMap[],
    talentCodes: string[],
): TeamResilienceResult {
    const teamTop15 = teamTalentRanks(membersRankMaps, talentCodes)
        .filter(tr => tr.teamRank <= 15);
    let coveredCount = 0;
    for (const tr of teamTop15) {
        const carriers = membersRankMaps.filter(m => {
            const r = m[tr.talent];
            return r !== undefined && r <= 10;
        }).length;
        if (carriers >= 2) coveredCount++;
    }
    const totalCount = teamTop15.length;
    return {
        percentage: totalCount > 0 ? Math.round((coveredCount / totalCount) * 100) : 0,
        coveredCount,
        totalCount,
    };
}
```

- [ ] **Step 2: Verify with a throwaway script (not committed)**

Write to the session scratchpad directory (NOT the repo) as `verify-algorithms.ts`:

```typescript
import { uniqueContributions, complementaryPairs, teamResilience } from '/Users/kamiltonkowicz/Documents/Coding/github/talentpilot/frontend/lib/team-algorithms';

// 3 members, 4 talents (toy universe)
const codes = ['t1', 't2', 't3', 't4'];
const m0 = { t1: 1, t2: 12, t3: 30, t4: 16 };   // t1 unique (others have t1 >15)
const m1 = { t1: 20, t2: 5, t3: 2, t4: 31 };
const m2 = { t1: 16, t2: 6, t3: 3, t4: 33 };

const uc = uniqueContributions([m0, m1, m2], codes);
console.assert(uc[0].talents.length === 1 && uc[0].talents[0].talentCode === 't1', 'm0 uniquely brings t1');
console.assert(uc[1].talents.length === 0, 'm1 has no unique talent (t2,t3 shared with m2)');

const cp = complementaryPairs([m0, m1, m2], codes);
// m0(t1=1) covers m1? m1.t1=20 -> no (needs >=30). m1(t3=2) covers m0.t3=30 -> yes.
const p01 = cp.find(p => p.memberA === 0 && p.memberB === 1)!;
console.assert(p01.bCoversA.length === 1 && p01.bCoversA[0].talentCode === 't3', 'm1 covers m0 on t3');
console.assert(p01.aCoversB.length === 0, 'm0 does not cover m1');

const res = teamResilience([m0, m1, m2], codes);
// team ranks over 4 talents; carriers in Top10: t1->1(m0), t2->2(m1,m2), t3->2(m1,m2), t4->0
// team Top15 = all 4 talents; covered = t2,t3 => 2/4 = 50%
console.assert(res.totalCount === 4 && res.coveredCount === 2 && res.percentage === 50, `resilience 50%, got ${JSON.stringify(res)}`);

console.log('All assertions passed');
```

Run from `frontend/`: `npx tsx <scratchpad>/verify-algorithms.ts`
Expected output: `All assertions passed` (console.assert prints nothing on success; any `Assertion failed` line = bug, fix before committing).

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/team-algorithms.ts
git commit -m "feat(frontend): unique contributions, complementary pairs, team resilience algorithms"
```

---

### Task 2: i18n keys (pl + en)

**Files:**
- Modify: `frontend/messages/pl.json` (inside the existing `"teams"` object)
- Modify: `frontend/messages/en.json` (inside the existing `"teams"` object)

**Interfaces:**
- Produces: translation keys used by Tasks 3–8 via `useTranslations('teams')`.

- [ ] **Step 1: Add keys to `pl.json` → `teams`**

Merge these keys into the existing `"teams"` object (keep existing keys untouched):

```json
{
    "profilesTab": "Profile",
    "teamRankList": "Ranga cechy zespołu",
    "talentHeatmap": "Heatmapa talentów",
    "talentHeatmapDesc": "Najczęstsze talenty w Top 15 członków zespołu",
    "teamWeaknesses": "Luki zespołowe",
    "teamWeaknessesDesc": "Talenty w Bottom 5 u znacznej części zespołu — obszary kosztujące zespół energię",
    "spofAlerts": "Krytyczne zależności (SPOF)",
    "spofAlertsDesc": "Talenty, gdzie tylko JEDNA osoba ma je w Top 10 — ryzyko przy odejściu",
    "soleCarrier": "Jedyna osoba",
    "noWeaknesses": "Brak istotnych luk — zespół ma dobre pokrycie talentów",
    "noSpof": "Brak krytycznych zależności — talenty są dobrze rozproszone",
    "ofTeam": "zespołu",
    "resilience": "Odporność zespołu",
    "resilienceDesc": "Odsetek talentów z Top 15 zespołu, które co najmniej dwie osoby mają w Top 10",
    "uniqueContributions": "Unikalny wkład",
    "uniqueContributionsDesc": "Talenty z Top 10 danej osoby, których nikt inny nie ma w Top 15 — to wnosi do zespołu tylko ona",
    "noUniqueContributions": "Brak talentów unikalnych — profil dobrze pokryty przez resztę zespołu",
    "complementaryPairs": "Pary komplementarne",
    "complementaryPairsDesc": "Osoba silna tam, gdzie druga traci energię — podpowiedzi do delegowania i wspólnej pracy",
    "pairCovers": "{name} wnosi",
    "noPairs": "Brak wyraźnych par komplementarnych",
    "needTwoMembers": "Potrzeba wyników co najmniej 2 osób",
    "specialistTooltip": "Uwaga! 4 z 5 pierwszych talentów mieści się w jednej domenie. Taka osoba może być ekspertem w swojej dziedzinie, ale może potrzebować wsparcia w pozostałych obszarach.",
    "columnTalents": "Talenty",
    "talentsLoadedCount": "{count} talentów",
    "uploadReport": "Wgraj raport",
    "uploadReportTitle": "Import raportu Gallupa",
    "uploadReportProcessing": "Przetwarzanie raportu...",
    "uploadReportSuccess": "Zaimportowano {count}/34 talentów dla {name}",
    "uploadReportError": "Nie udało się zaimportować raportu"
}
```

- [ ] **Step 2: Add keys to `en.json` → `teams`**

```json
{
    "profilesTab": "Profiles",
    "teamRankList": "Team Talent Rank",
    "talentHeatmap": "Talent Heatmap",
    "talentHeatmapDesc": "Most common talents in members' Top 15",
    "teamWeaknesses": "Team Weaknesses",
    "teamWeaknessesDesc": "Talents in Bottom 5 for a significant part of the team — areas that cost the team energy",
    "spofAlerts": "Critical Dependencies (SPOF)",
    "spofAlertsDesc": "Talents where only ONE person has it in Top 10 — risk if they leave",
    "soleCarrier": "Only person",
    "noWeaknesses": "No significant weaknesses detected — the team has good coverage",
    "noSpof": "No critical dependencies — talents are well distributed",
    "ofTeam": "of team",
    "resilience": "Team Resilience",
    "resilienceDesc": "Share of the team's Top 15 talents that at least two members carry in their Top 10",
    "uniqueContributions": "Unique Contributions",
    "uniqueContributionsDesc": "Talents from a person's Top 10 that nobody else has in their Top 15 — what only they bring to the team",
    "noUniqueContributions": "No unique talents — this profile is well covered by the rest of the team",
    "complementaryPairs": "Complementary Pairs",
    "complementaryPairsDesc": "One person strong where the other loses energy — hints for delegation and pairing",
    "pairCovers": "{name} brings",
    "noPairs": "No clear complementary pairs",
    "needTwoMembers": "Requires results from at least 2 members",
    "specialistTooltip": "Warning! 4 out of 5 top talents are in one domain. This person may be an expert in their area, but may need support in other areas.",
    "columnTalents": "Talents",
    "talentsLoadedCount": "{count} talents",
    "uploadReport": "Upload report",
    "uploadReportTitle": "Gallup report import",
    "uploadReportProcessing": "Processing report...",
    "uploadReportSuccess": "Imported {count}/34 talents for {name}",
    "uploadReportError": "Failed to import the report"
}
```

- [ ] **Step 3: Validate JSON**

Run: `python3 -c "import json; json.load(open('frontend/messages/pl.json')); json.load(open('frontend/messages/en.json')); print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add frontend/messages/pl.json frontend/messages/en.json
git commit -m "feat(frontend): i18n keys for team analytics sections"
```

---

### Task 3: TeamRankList + TalentHeatmap components

**Files:**
- Create: `frontend/components/dashboard/TeamRankList.tsx`
- Create: `frontend/components/dashboard/TalentHeatmap.tsx`

**Interfaces:**
- Consumes: `TeamTalentRankResult` from `@/lib/team-algorithms`; `GALLUP_TALENTS`, `getDomainStyle` from `@/lib/gallup-data`.
- Produces:
  - `<TeamRankList teamRanks={TeamTalentRankResult[]} topN={number} />`
  - `<TalentHeatmap counts={Record<string, number>} />` (counts = talentCode → how many members have it in Top 15)

- [ ] **Step 1: Create `TeamRankList.tsx`**

```tsx
"use client";

import { useTranslations } from 'next-intl';
import { getLocaleFromCookie } from '@/lib/locale';
import { GALLUP_TALENTS, getDomainStyle } from '@/lib/gallup-data';
import type { TeamTalentRankResult } from '@/lib/team-algorithms';

interface TeamRankListProps {
    teamRanks: TeamTalentRankResult[];
    topN: number;
}

export default function TeamRankList({ teamRanks, topN }: TeamRankListProps) {
    const t = useTranslations('teams');
    const locale = getLocaleFromCookie();

    const topRanks = teamRanks.filter(tr => tr.teamRank <= topN);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">{t('teamRankList')}</h3>
            <div className="flex flex-col gap-1.5">
                {topRanks.map(tr => {
                    const talent = GALLUP_TALENTS.find(gt => gt.code === tr.talent);
                    if (!talent) return null;
                    return (
                        <div
                            key={tr.talent}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide"
                            style={{
                                background: getDomainStyle(talent.domain, 15),
                                color: getDomainStyle(talent.domain),
                            }}
                        >
                            #{tr.teamRank} {locale === 'en' ? talent.en : talent.pl}
                        </div>
                    );
                })}
                {topRanks.length === 0 && (
                    <p className="text-sm text-slate-500">{t('noData')}</p>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Create `TalentHeatmap.tsx`**

```tsx
"use client";

import { useTranslations } from 'next-intl';
import { getLocaleFromCookie } from '@/lib/locale';
import { GALLUP_TALENTS, getDomainStyle } from '@/lib/gallup-data';

interface TalentHeatmapProps {
    counts: Record<string, number>;  // talentCode -> members with it in Top 15
}

export default function TalentHeatmap({ counts }: TalentHeatmapProps) {
    const t = useTranslations('teams');
    const locale = getLocaleFromCookie();

    const entries = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900">{t('talentHeatmap')}</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">{t('talentHeatmapDesc')}</p>
            <div className="flex flex-wrap gap-2">
                {entries.map(([code, count]) => {
                    const talent = GALLUP_TALENTS.find(gt => gt.code === code);
                    if (!talent) return null;
                    return (
                        <span
                            key={code}
                            className="px-3.5 py-1.5 rounded-lg text-sm font-semibold uppercase tracking-wide"
                            style={{
                                background: getDomainStyle(talent.domain, 15),
                                color: getDomainStyle(talent.domain),
                            }}
                        >
                            {locale === 'en' ? talent.en : talent.pl} ({count})
                        </span>
                    );
                })}
                {entries.length === 0 && (
                    <p className="text-sm text-slate-500">{t('noData')}</p>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/dashboard/TeamRankList.tsx frontend/components/dashboard/TalentHeatmap.tsx
git commit -m "feat(frontend): team rank list and talent heatmap components"
```

---

### Task 4: TeamRisks component (weaknesses + SPOF + resilience KPI)

**Files:**
- Create: `frontend/components/dashboard/TeamRisks.tsx`

**Interfaces:**
- Consumes: `TeamWeaknessResult`, `SPOFResult`, `TeamResilienceResult` types from `@/lib/team-algorithms`.
- Produces: `<TeamRisks weaknesses={...} spof={...} resilience={...} memberNames={string[]} membersWithResultsCount={number} />`
  - `memberNames[i]` corresponds to `membersRankMaps[i]` (SPOF's `memberIndex` indexes into it).

- [ ] **Step 1: Create `TeamRisks.tsx`**

```tsx
"use client";

import { useTranslations } from 'next-intl';
import { getLocaleFromCookie } from '@/lib/locale';
import { GALLUP_TALENTS, getDomainStyle } from '@/lib/gallup-data';
import type { TeamWeaknessResult, SPOFResult, TeamResilienceResult } from '@/lib/team-algorithms';
import { TrendingDown, ShieldAlert, AlertTriangle, ShieldCheck } from 'lucide-react';

interface TeamRisksProps {
    weaknesses: TeamWeaknessResult[];
    spof: SPOFResult[];
    resilience: TeamResilienceResult;
    memberNames: string[];               // index-aligned with membersRankMaps
    membersWithResultsCount: number;
}

export default function TeamRisks({ weaknesses, spof, resilience, memberNames, membersWithResultsCount }: TeamRisksProps) {
    const t = useTranslations('teams');
    const locale = getLocaleFromCookie();

    if (membersWithResultsCount < 2) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:col-span-2">
                <p className="text-sm text-slate-500">{t('needTwoMembers')}</p>
            </div>
        );
    }

    return (
        <>
            {/* Team Weaknesses */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-rose-500" />
                    <h3 className="text-lg font-semibold text-slate-900">{t('teamWeaknesses')}</h3>
                </div>
                <p className="text-sm text-slate-500 mt-1 mb-4">{t('teamWeaknessesDesc')}</p>
                {weaknesses.length > 0 ? (
                    <div className="space-y-3">
                        {weaknesses.slice(0, 10).map(w => {
                            const talent = GALLUP_TALENTS.find(gt => gt.code === w.talentCode);
                            if (!talent) return null;
                            return (
                                <div key={w.talentCode} className="flex items-center gap-3">
                                    <div className="w-36 shrink-0 text-sm font-semibold" style={{ color: getDomainStyle(talent.domain) }}>
                                        {locale === 'en' ? talent.en : talent.pl}
                                    </div>
                                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-600"
                                            style={{ width: `${w.percentage}%` }}
                                        />
                                    </div>
                                    <div className="w-20 shrink-0 text-right text-xs text-slate-500">
                                        {w.percentage}% {t('ofTeam')}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500">✅ {t('noWeaknesses')}</p>
                )}
            </div>

            {/* SPOF + Resilience KPI */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-amber-500" />
                        <h3 className="text-lg font-semibold text-slate-900">{t('spofAlerts')}</h3>
                    </div>
                    <div
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-sm font-semibold text-slate-700"
                        title={t('resilienceDesc')}
                    >
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        {t('resilience')}: {resilience.percentage}%
                    </div>
                </div>
                <p className="text-sm text-slate-500 mt-1 mb-4">{t('spofAlertsDesc')}</p>
                {spof.length > 0 ? (
                    <div className="space-y-2">
                        {spof.slice(0, 10).map(item => {
                            const talent = GALLUP_TALENTS.find(gt => gt.code === item.talentCode);
                            const carrier = memberNames[item.memberIndex];
                            if (!talent || carrier === undefined) return null;
                            return (
                                <div
                                    key={item.talentCode}
                                    className="flex items-center gap-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100"
                                >
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                    <div>
                                        <div className="text-sm font-semibold" style={{ color: getDomainStyle(talent.domain) }}>
                                            {locale === 'en' ? talent.en : talent.pl}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {t('soleCarrier')}: {carrier} (#{item.memberRank})
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500">✅ {t('noSpof')}</p>
                )}
            </div>
        </>
    );
}
```

- [ ] **Step 2: Lint**

Run: `cd frontend && npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/dashboard/TeamRisks.tsx
git commit -m "feat(frontend): team weaknesses, SPOF and resilience component"
```

---

### Task 5: UniqueContributions + ComplementaryPairs components

**Files:**
- Create: `frontend/components/dashboard/UniqueContributions.tsx`
- Create: `frontend/components/dashboard/ComplementaryPairs.tsx`

**Interfaces:**
- Consumes: `UniqueContributionResult`, `ComplementaryPairResult` from `@/lib/team-algorithms` (Task 1).
- Produces:
  - `<UniqueContributions contributions={UniqueContributionResult[]} memberNames={string[]} />`
  - `<ComplementaryPairs pairs={ComplementaryPairResult[]} memberNames={string[]} membersWithResultsCount={number} />`

- [ ] **Step 1: Create `UniqueContributions.tsx`**

```tsx
"use client";

import { useTranslations } from 'next-intl';
import { getLocaleFromCookie } from '@/lib/locale';
import { GALLUP_TALENTS, getDomainStyle } from '@/lib/gallup-data';
import type { UniqueContributionResult } from '@/lib/team-algorithms';
import { Sparkles } from 'lucide-react';

interface UniqueContributionsProps {
    contributions: UniqueContributionResult[];
    memberNames: string[];   // index-aligned with membersRankMaps
}

export default function UniqueContributions({ contributions, memberNames }: UniqueContributionsProps) {
    const t = useTranslations('teams');
    const locale = getLocaleFromCookie();

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-semibold text-slate-900">{t('uniqueContributions')}</h3>
            </div>
            <p className="text-sm text-slate-500 mt-1 mb-4">{t('uniqueContributionsDesc')}</p>
            <div className="space-y-3">
                {contributions.map(c => (
                    <div key={c.memberIndex} className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 w-40 shrink-0">
                            {memberNames[c.memberIndex]}
                        </span>
                        {c.talents.length > 0 ? (
                            c.talents.map(({ talentCode, rank }) => {
                                const talent = GALLUP_TALENTS.find(gt => gt.code === talentCode);
                                if (!talent) return null;
                                return (
                                    <span
                                        key={talentCode}
                                        className="px-2.5 py-1 rounded-md text-xs font-semibold"
                                        style={{
                                            background: getDomainStyle(talent.domain, 15),
                                            color: getDomainStyle(talent.domain),
                                        }}
                                    >
                                        #{rank} {locale === 'en' ? talent.en : talent.pl}
                                    </span>
                                );
                            })
                        ) : (
                            <span className="text-xs text-slate-400 italic">{t('noUniqueContributions')}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Create `ComplementaryPairs.tsx`**

```tsx
"use client";

import { useTranslations } from 'next-intl';
import { getLocaleFromCookie } from '@/lib/locale';
import { GALLUP_TALENTS, getDomainStyle } from '@/lib/gallup-data';
import type { ComplementaryPairResult, PairCoverage } from '@/lib/team-algorithms';
import { Handshake } from 'lucide-react';

interface ComplementaryPairsProps {
    pairs: ComplementaryPairResult[];
    memberNames: string[];   // index-aligned with membersRankMaps
    membersWithResultsCount: number;
}

function CoverageRow({ coverage, locale, label }: { coverage: PairCoverage[]; locale: string; label: string }) {
    if (coverage.length === 0) return null;
    return (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-600">{label}</span>
            {coverage.map(cov => {
                const talent = GALLUP_TALENTS.find(gt => gt.code === cov.talentCode);
                if (!talent) return null;
                return (
                    <span
                        key={cov.talentCode}
                        className="px-2 py-0.5 rounded font-semibold"
                        style={{
                            background: getDomainStyle(talent.domain, 15),
                            color: getDomainStyle(talent.domain),
                        }}
                        title={`#${cov.coveringRank} vs #${cov.coveredRank}`}
                    >
                        {locale === 'en' ? talent.en : talent.pl}
                    </span>
                );
            })}
        </div>
    );
}

export default function ComplementaryPairs({ pairs, memberNames, membersWithResultsCount }: ComplementaryPairsProps) {
    const t = useTranslations('teams');
    const locale = getLocaleFromCookie();

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2">
                <Handshake className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-semibold text-slate-900">{t('complementaryPairs')}</h3>
            </div>
            <p className="text-sm text-slate-500 mt-1 mb-4">{t('complementaryPairsDesc')}</p>
            {membersWithResultsCount < 2 ? (
                <p className="text-sm text-slate-500">{t('needTwoMembers')}</p>
            ) : pairs.length > 0 ? (
                <div className="space-y-4">
                    {pairs.slice(0, 5).map(pair => (
                        <div key={`${pair.memberA}-${pair.memberB}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-1.5">
                            <div className="text-sm font-semibold text-slate-900">
                                {memberNames[pair.memberA]} ↔ {memberNames[pair.memberB]}
                            </div>
                            <CoverageRow
                                coverage={pair.aCoversB}
                                locale={locale}
                                label={t('pairCovers', { name: memberNames[pair.memberA] }) + ':'}
                            />
                            <CoverageRow
                                coverage={pair.bCoversA}
                                locale={locale}
                                label={t('pairCovers', { name: memberNames[pair.memberB] }) + ':'}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-slate-500">{t('noPairs')}</p>
            )}
        </div>
    );
}
```

Note: if `Handshake` is not exported by the installed lucide-react version, use `Users` instead (check with lint/build).

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/dashboard/UniqueContributions.tsx frontend/components/dashboard/ComplementaryPairs.tsx
git commit -m "feat(frontend): unique contributions and complementary pairs components"
```

---

### Task 6: MemberProfileCards + MatrixDashboard integration

**Files:**
- Create: `frontend/components/dashboard/MemberProfileCards.tsx`
- Modify: `frontend/components/dashboard/MatrixDashboard.tsx`

**Interfaces:**
- Consumes: all components from Tasks 3–5; `checkDomainSpecialist`, `findTeamWeaknesses`, `findSPOF`, `teamResilience`, `uniqueContributions`, `complementaryPairs` from `@/lib/team-algorithms`.
- Produces: `MatrixDashboard` accepts a new prop `canSeeRisks: boolean` (default `false`). `Member` interface stays `{ id, name, role?, results }`.

- [ ] **Step 1: Create `MemberProfileCards.tsx`**

```tsx
"use client";

import { useTranslations } from 'next-intl';
import { getLocaleFromCookie } from '@/lib/locale';
import { GALLUP_TALENTS, getDomainStyle, DOMAIN_LABELS, GallupDomain } from '@/lib/gallup-data';
import { checkDomainSpecialist } from '@/lib/team-algorithms';
import { Star } from 'lucide-react';

interface TalentResult {
    id: string | number;
    rank: number;
    talent: string;
    domain: string;
}

interface Member {
    id: string | number;
    name: string;
    role?: string;
    results: TalentResult[];
}

interface MemberProfileCardsProps {
    members: Member[];   // only members with results
    topN: number;        // 5 or 15
}

export default function MemberProfileCards({ members, topN }: MemberProfileCardsProps) {
    const t = useTranslations('teams');
    const locale = getLocaleFromCookie();
    const talentCodes = GALLUP_TALENTS.map(gt => gt.code);
    const talentDomainMap: Record<string, GallupDomain> = {};
    GALLUP_TALENTS.forEach(gt => { talentDomainMap[gt.code] = gt.domain; });

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {members.map(member => {
                const topTalents = member.results
                    .filter(r => r.rank <= topN)
                    .sort((a, b) => a.rank - b.rank);

                const domainProfile: Record<GallupDomain, number> = {
                    executing: 0, influencing: 0, relationship_building: 0, strategic_thinking: 0,
                };
                topTalents.forEach(r => {
                    const d = r.domain as GallupDomain;
                    if (domainProfile[d] !== undefined) domainProfile[d]++;
                });
                const topDomain = (Object.entries(domainProfile) as [GallupDomain, number][])
                    .sort((a, b) => b[1] - a[1])[0];

                const rankMap: Record<string, number> = {};
                member.results.forEach(r => { rankMap[r.talent] = r.rank; });
                const specialist = checkDomainSpecialist(rankMap, talentCodes, talentDomainMap);

                return (
                    <div key={member.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">{member.name}</h3>
                                {member.role && <p className="text-xs text-slate-500">{member.role}</p>}
                            </div>
                            <div className="relative inline-flex">
                                <span
                                    className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
                                    style={{
                                        background: getDomainStyle(topDomain[0], 15),
                                        color: getDomainStyle(topDomain[0]),
                                    }}
                                >
                                    {locale === 'en' ? DOMAIN_LABELS[topDomain[0]]?.en : DOMAIN_LABELS[topDomain[0]]?.pl}
                                </span>
                                {specialist.isSpecialist && (
                                    <span
                                        className="absolute -top-2 -right-2 cursor-help"
                                        title={t('specialistTooltip')}
                                        style={{ color: getDomainStyle(topDomain[0]) }}
                                    >
                                        <Star className="w-3.5 h-3.5" fill="currentColor" />
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {topTalents.map(r => {
                                const talent = GALLUP_TALENTS.find(gt => gt.code === r.talent);
                                if (!talent) return null;
                                return (
                                    <span
                                        key={r.talent}
                                        className="px-2.5 py-1 rounded-md text-xs font-semibold border"
                                        style={{
                                            background: getDomainStyle(talent.domain, 15),
                                            color: getDomainStyle(talent.domain),
                                            borderColor: getDomainStyle(talent.domain, 25),
                                        }}
                                    >
                                        #{r.rank} {locale === 'en' ? talent.en : talent.pl}
                                    </span>
                                );
                            })}
                        </div>

                        <div className="flex gap-1">
                            {(Object.entries(domainProfile) as [GallupDomain, number][]).map(([d, count]) => (
                                <div
                                    key={d}
                                    className="h-1.5 rounded-full transition-all"
                                    style={{
                                        flex: count || 0.2,
                                        background: count ? getDomainStyle(d) : getDomainStyle(d, 15),
                                    }}
                                    title={`${locale === 'en' ? DOMAIN_LABELS[d]?.en : DOMAIN_LABELS[d]?.pl}: ${count}`}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 2: Extend `MatrixDashboard.tsx`**

Changes (surgical — keep matrix tab code untouched):

a) Props and imports:

```tsx
// add to imports
import { BarChart3 } from 'lucide-react';   // extend existing lucide import
import {
    teamTalentRanks, teamDomainScores, findTeamWeaknesses, findSPOF,
    teamResilience, uniqueContributions, complementaryPairs,
} from '@/lib/team-algorithms';
import TeamRankList from '@/components/dashboard/TeamRankList';
import TalentHeatmap from '@/components/dashboard/TalentHeatmap';
import TeamRisks from '@/components/dashboard/TeamRisks';
import UniqueContributions from '@/components/dashboard/UniqueContributions';
import ComplementaryPairs from '@/components/dashboard/ComplementaryPairs';
import MemberProfileCards from '@/components/dashboard/MemberProfileCards';

interface MatrixDashboardProps {
    members: Member[];
    canSeeRisks?: boolean;
}

export default function MatrixDashboard({ members, canSeeRisks = false }: MatrixDashboardProps) {
```

b) Tab state gets the third value and a profiles toggle:

```tsx
const [activeTab, setActiveTab] = useState<'matrix' | 'domains' | 'profiles'>('matrix');
const [showTop15Profiles, setShowTop15Profiles] = useState(true);
```

c) After the existing `talentTop15Counts` computation, add derived analytics (all computed from existing `membersRankMaps` / `talentCodes`):

```tsx
const memberNames = membersWithResults.map(m => m.name);
const weaknesses = membersRankMaps.length >= 2 ? findTeamWeaknesses(membersRankMaps, talentCodes) : [];
const spofList = membersRankMaps.length >= 2 ? findSPOF(membersRankMaps, talentCodes) : [];
const resilience = teamResilience(membersRankMaps, talentCodes);
const contributions = membersRankMaps.length >= 2 ? uniqueContributions(membersRankMaps, talentCodes) : [];
const pairs = membersRankMaps.length >= 2 ? complementaryPairs(membersRankMaps, talentCodes) : [];
```

d) Tab bar: add a third button after the `domains` button, same styling pattern:

```tsx
<button
    onClick={() => setActiveTab('profiles')}
    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        activeTab === 'profiles'
        ? 'bg-slate-900 text-white'
        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
    }`}
>
    <BarChart3 className="w-4 h-4" />
    {t('profilesTab')}
</button>
```

e) Domains tab: replace the current 2-column grid wrapper content with the extended layout. The existing pie card and radar card blocks are kept verbatim — only re-arranged into this structure:

```tsx
{activeTab === 'domains' && (
    <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-[4fr_2fr_4fr] gap-6">
            {/* existing pie card (unchanged) */}
            {/* NEW: */}
            <TeamRankList teamRanks={teamRanks} topN={showTop15Domains ? 15 : 5} />
            {/* existing radar card (unchanged) */}
        </div>

        <TalentHeatmap counts={talentTop15Counts} />

        {canSeeRisks && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TeamRisks
                    weaknesses={weaknesses}
                    spof={spofList}
                    resilience={resilience}
                    memberNames={memberNames}
                    membersWithResultsCount={membersWithResults.length}
                />
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UniqueContributions contributions={contributions} memberNames={memberNames} />
            {canSeeRisks && (
                <ComplementaryPairs
                    pairs={pairs}
                    memberNames={memberNames}
                    membersWithResultsCount={membersWithResults.length}
                />
            )}
        </div>
    </div>
)}
```

f) Profiles tab (new block after domains tab):

```tsx
{activeTab === 'profiles' && (
    <div className="space-y-4">
        <div className="flex justify-end">
            <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                    onClick={() => setShowTop15Profiles(false)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${!showTop15Profiles ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    Top 5
                </button>
                <button
                    onClick={() => setShowTop15Profiles(true)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${showTop15Profiles ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    Top 15
                </button>
            </div>
        </div>
        {membersWithResults.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-500">
                {t('noTalentData')}
            </div>
        ) : (
            <MemberProfileCards members={membersWithResults} topN={showTop15Profiles ? 15 : 5} />
        )}
    </div>
)}
```

- [ ] **Step 3: Lint + build**

Run: `cd frontend && npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/dashboard/MemberProfileCards.tsx frontend/components/dashboard/MatrixDashboard.tsx
git commit -m "feat(frontend): profiles tab and extended domains analytics in MatrixDashboard"
```

---

### Task 7: Team page restructure (always-on analytics, simplified collapsible members list)

**Files:**
- Modify: `frontend/app/(dashboard)/dashboard/teams/[id]/page.tsx`

**Interfaces:**
- Consumes: `MatrixDashboard` with `canSeeRisks` prop (Task 6); `tokenManager` from `@/lib/api`.
- Produces: page layout that Task 8 extends with the upload action.

- [ ] **Step 1: Compute `canSeeRisks` and remove the matrix toggle**

In `TeamDetailPage`:
- Add import: `import { tokenManager } from "@/lib/api";` (it is already exported there; `api` import stays).
- Remove state `const [showMatrix, setShowMatrix] = useState(false);` and the `showMatrix` toggle `<Button>` in the header.
- Add:

```tsx
const currentUser = tokenManager.getUser();
const isPrivileged = !!currentUser && ['coach', 'admin', 'manager'].includes(currentUser.role);
const isTeamLeader = !!currentUser && members.some(m => m.is_leader && Number(m.id) === currentUser.id);
const canSeeRisks = isPrivileged || isTeamLeader;
```

- Replace `{showMatrix && (<MatrixDashboard members={members} />)}` with an always-rendered block placed directly under the header card:

```tsx
<MatrixDashboard members={members} canSeeRisks={canSeeRisks} />
```

- [ ] **Step 2: Simplify + collapse the members table**

- Add state: `const [membersExpanded, setMembersExpanded] = useState(false);`
- Make the members-card header a toggle: wrap the existing title/search block so clicking the title row toggles `membersExpanded`; add a chevron:

```tsx
<button
    type="button"
    onClick={() => setMembersExpanded(!membersExpanded)}
    className="w-full p-6 flex items-center justify-between text-left"
>
    <div>
        <h2 className="text-xl font-semibold text-slate-900">
            {t('membersTableTitle')} <span className="text-sm font-normal text-slate-500 ml-2">({members.length})</span>
        </h2>
        <p className="text-sm text-slate-500 mt-1">{t('membersTableDesc')}</p>
    </div>
    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${membersExpanded ? 'rotate-180' : ''}`} />
</button>
{membersExpanded && (
    <div className="border-t border-slate-100">
        {/* search input row (existing markup, moved here) */}
        {/* existing empty-state / table markup */}
    </div>
)}
```

- In the table itself, replace the Top 5 column:
  - Header: `{t('columnTop5')}` → `{t('columnTalents')}`
  - Cell: remove the whole `top5.map(...)` badge block (and the now-unused `top5` computation) and render a count instead:

```tsx
<td className="py-4 px-6">
    {member.results.length > 0 ? (
        <span className="text-sm text-emerald-600 font-medium">
            ✓ {t('talentsLoadedCount', { count: member.results.length })}
        </span>
    ) : (
        <span className="text-sm text-slate-400 italic">{t('noTalentsEntered')}</span>
    )}
</td>
```

- Remove imports that became unused by deleting the badge block (`DOMAIN_CSS_KEY`, `cn`, possibly `GALLUP_TALENTS` — keep whatever is still used by the add-member dialog, which uses `GALLUP_TALENTS`).
- Keep all existing actions (resend invite, crown/leader, edit, delete) unchanged.

- [ ] **Step 3: Lint + build**

Run: `cd frontend && npm run lint && npm run build`
Expected: both pass (unused-import errors here mean Step 2's cleanup is incomplete).

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/(dashboard)/dashboard/teams/[id]/page.tsx"
git commit -m "feat(frontend): always-on team analytics, simplified collapsible members list"
```

---

### Task 8: Per-member report upload

**Files:**
- Create: `frontend/components/dashboard/MemberReportUpload.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/teams/[id]/page.tsx` (actions column)

**Interfaces:**
- Consumes: `api.gallup.parsePdf(file, language?)` → `{ rankings: Record<string, number>, first_name, last_name, ... }`; `api.gallup.saveTalents(userId, rankings, language?)` → `UserTalentResponse[]` (replaces user's talents).
- Produces: `<MemberReportUpload userId={number} memberName={string} onDone={() => void | Promise<void>} />` — a button + hidden file input + result dialog.

- [ ] **Step 1: Create `MemberReportUpload.tsx`**

```tsx
"use client";

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getLocaleFromCookie } from '@/lib/locale';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Check, X } from 'lucide-react';

interface MemberReportUploadProps {
    userId: number;
    memberName: string;
    onDone: () => void | Promise<void>;
}

type UploadState =
    | { phase: 'idle' }
    | { phase: 'processing' }
    | { phase: 'success'; count: number }
    | { phase: 'error'; message: string };

export default function MemberReportUpload({ userId, memberName, onDone }: MemberReportUploadProps) {
    const t = useTranslations('teams');
    const tCommon = useTranslations('common');
    const locale = getLocaleFromCookie();
    const inputRef = useRef<HTMLInputElement>(null);
    const [state, setState] = useState<UploadState>({ phase: 'idle' });
    const dialogOpen = state.phase !== 'idle';

    const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setState({ phase: 'processing' });
        try {
            const parsed = await api.gallup.parsePdf(file, locale);
            const rankings: Record<string, number> = parsed.rankings || {};
            if (Object.keys(rankings).length === 0) {
                setState({ phase: 'error', message: t('uploadReportError') });
                return;
            }
            const saved = await api.gallup.saveTalents(userId, rankings, locale);
            setState({ phase: 'success', count: Array.isArray(saved) ? saved.length : Object.keys(rankings).length });
            await onDone();
        } catch (err: unknown) {
            const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
            setState({ phase: 'error', message: typeof detail === 'string' ? detail : t('uploadReportError') });
        }
    };

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={onFileSelect}
            />
            <button
                onClick={() => inputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title={t('uploadReport')}
            >
                <Upload className="w-4 h-4" />
            </button>

            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && state.phase !== 'processing') setState({ phase: 'idle' }); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{t('uploadReportTitle')}</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center gap-3 py-2">
                        {state.phase === 'processing' && (
                            <>
                                <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />
                                <p className="text-sm text-slate-600">{t('uploadReportProcessing')}</p>
                            </>
                        )}
                        {state.phase === 'success' && (
                            <>
                                <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                                <p className="text-sm text-slate-700">
                                    {t('uploadReportSuccess', { count: state.count, name: memberName })}
                                </p>
                            </>
                        )}
                        {state.phase === 'error' && (
                            <>
                                <X className="w-5 h-5 text-rose-500 shrink-0" />
                                <p className="text-sm text-rose-700">{state.message}</p>
                            </>
                        )}
                    </div>
                    {state.phase !== 'processing' && (
                        <div className="flex justify-end">
                            <Button onClick={() => setState({ phase: 'idle' })}>{tCommon('close')}</Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
```

- [ ] **Step 2: Wire into the actions column of the members table**

In `teams/[id]/page.tsx`, inside the actions `div` (before the crown button), add — rendered only for privileged roles (backend returns 403 for role `user` uploading for others):

```tsx
{isPrivileged && (
    <MemberReportUpload
        userId={parseInt(member.id as string)}
        memberName={member.name}
        onDone={loadTeamData}
    />
)}
```

Add import: `import MemberReportUpload from "@/components/dashboard/MemberReportUpload";`

- [ ] **Step 3: Lint + build**

Run: `cd frontend && npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/dashboard/MemberReportUpload.tsx "frontend/app/(dashboard)/dashboard/teams/[id]/page.tsx"
git commit -m "feat(frontend): per-member Gallup report upload with import count confirmation"
```

---

### Task 9: End-to-end verification in the browser

**Files:** none (verification only; fix regressions where found)

- [ ] **Step 1: Start the app**

Backend + frontend per repo docs (`docker-compose.yml` dev stack, or `cd frontend && npm run dev` against a running backend on :8000). Log in as a coach account.

- [ ] **Step 2: Walk the team view**

On a team with ≥4 members with full Top 34 results verify:
1. Analytics visible immediately (no "show matrix" button); 3 tabs: Matryca / Domeny / Profile.
2. Domeny: donut + rank list (#1..#15 tags, domain colors) + radar in one row; heatmap row; risk row (Luki with % bars, SPOF with names, resilience KPI); Unikalny wkład + Pary komplementarne.
3. Top 5 / Top 15 toggle affects donut and rank list.
4. Profile: cards with dominant-domain badge, specialist star only when ≥4 of Top 5 in one domain (tooltip text), talent badges, domain proportion bar; Top 5/15 toggle.
5. Members list collapsed by default; expands with chevron; no talent badges — only "✓ N talentów"; search works after expanding.
6. Upload a real Gallup PDF for an existing member → dialog shows "Zaimportowano X/34 talentów dla {name}"; matrix refreshes with new ranks. Upload a non-Gallup PDF → readable error, no state change.
7. Log in as a plain member (role `user`, not leader): risk sections and pairs hidden; matrix/domains/profiles/unique contributions visible; no upload button.
8. Team with 1 member with results: risk sections show "Potrzeba wyników co najmniej 2 osób"; nothing crashes.
9. Switch language to EN (user language setting): all new sections render EN texts.

- [ ] **Step 3: Fix anything found, re-run lint + build, commit fixes**

```bash
git add -A && git commit -m "fix(frontend): team analytics verification fixes"
```

(Skip the commit if nothing needed fixing.)
