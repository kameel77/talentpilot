"""Compare service — deterministic talent comparison engine."""
from __future__ import annotations

from sqlalchemy.orm import Session

from models import Talent, TalentTranslation, User, UserTalent
from services.assistant_service import DOMAIN_LABELS


def get_user_talents_for_compare(
    db: Session, user_id: int, language: str = "pl", limit: int = 15
) -> list[dict]:
    """Return ordered talent info for a user (Top N)."""
    rows = (
        db.query(UserTalent, TalentTranslation, Talent)
        .join(TalentTranslation, UserTalent.talent_id == TalentTranslation.talent_id)
        .join(Talent, UserTalent.talent_id == Talent.id)
        .filter(
            UserTalent.user_id == user_id,
            TalentTranslation.language == language,
            UserTalent.rank <= limit,
        )
        .order_by(UserTalent.rank.asc())
        .all()
    )
    return [
        {
            "code": t.code,
            "name": trans.name,
            "domain": t.domain.value if hasattr(t.domain, "value") else str(t.domain),
            "rank": ut.rank,
        }
        for ut, trans, t in rows
    ]


def _domain_counts(talents: list[dict]) -> dict[str, int]:
    """Count talents per domain."""
    counts: dict[str, int] = {}
    for t in talents:
        counts[t["domain"]] = counts.get(t["domain"], 0) + 1
    return counts


def _synergy_score(shared: list, talents_a: list, talents_b: list) -> int:
    """Calculate a 0-100 synergy score.
    
    Factors:
    - Shared talents (mosty) in Top 15 → strong signal of natural understanding
    - Domain diversity (uzupełnianie się) → complementary strengths
    - Rank proximity of shared talents → closer ranks = stronger bridge
    """
    if not talents_a or not talents_b:
        return 0

    # 1. Shared talent bonus (0-40 pts): more shared = better understanding
    shared_score = min(len(shared) * 8, 40)

    # 2. Domain diversity bonus (0-30 pts): team covers more domains
    domains_a = set(t["domain"] for t in talents_a[:5])
    domains_b = set(t["domain"] for t in talents_b[:5])
    combined_domains = domains_a | domains_b
    diversity_score = min(len(combined_domains) * 8, 30)

    # 3. Rank proximity bonus for shared talents (0-30 pts)
    if shared:
        proximity_sum = sum(
            max(0, 15 - abs(s["rank_a"] - s["rank_b"])) for s in shared
        )
        proximity_score = min(int(proximity_sum / len(shared) * 2), 30)
    else:
        # No shared talents → some base score from domain overlap
        overlap = domains_a & domains_b
        proximity_score = min(len(overlap) * 5, 15)

    return min(shared_score + diversity_score + proximity_score, 100)


# Collaboration tip templates based on talent patterns
COLLABORATION_TIPS_PL = {
    "shared_executing": "Oboje silni w Realizacji — ustalcie jasny podział zadań, by nie dublować pracy.",
    "shared_influencing": "Wspólna siła we Wpływaniu — świetny duet do prezentacji i negocjacji. Uważajcie, by nie konkurować o uwagę.",
    "shared_relationship": "Oboje silni w relacjach — naturalne zrozumienie emocji. Pilnujcie, by decyzje nie były opóźniane przez empatię.",
    "shared_strategic": "Oboje myślą strategicznie — burza mózgów będzie owocna. Potrzebujecie kogoś z Realizacji do wdrożenia pomysłów.",
    "complement_exec_strat": "Jeden realizuje, drugi planuje — idealny tandem. Strategik niech daje Realizatorowi wyraźne priorytety.",
    "complement_infl_rel": "Jeden wpływa, drugi buduje relacje — Wpływający niech inicjuje, Relacyjny niech buduje zaufanie.",
    "complement_exec_rel": "Realizator + Relacyjny — jeden dowozi wyniki, drugi dba o ludzi. Idealne uzupełnienie w zespole.",
    "complement_infl_strat": "Wpływający + Strateg — Strateg planuje, Wpływający sprzedaje wizję. Razem porywają za sobą zespół.",
    "many_shared": "Wiele wspólnych talentów = naturalne porozumienie. Ryzyko: blind spots w brakujących domenach.",
    "few_shared": "Mało wspólnych talentów = silne uzupełnianie. Inwestujcie czas w zrozumienie perspektywy partnera.",
    "both_top5_same": "Te same talenty w Top 5 — rozmawiajcie o tym, jak je wykorzystać bez rywalizacji.",
    "balance_all_domains": "Razem pokrywacie wszystkie 4 domeny — to rzadkość! Wykorzystajcie tę kompletność w projekcie.",
}


def _generate_tips(
    shared: list[dict],
    talents_a: list[dict],
    talents_b: list[dict],
    domain_balance: list[dict],
) -> list[str]:
    """Generate 3-5 collaboration tips based on talent patterns."""
    tips: list[str] = []
    domains_a = _domain_counts(talents_a[:5])
    domains_b = _domain_counts(talents_b[:5])
    all_domains = set(domains_a.keys()) | set(domains_b.keys())

    # Tip: many or few shared talents
    if len(shared) >= 4:
        tips.append(COLLABORATION_TIPS_PL["many_shared"])
    elif len(shared) <= 1:
        tips.append(COLLABORATION_TIPS_PL["few_shared"])

    # Tip: same Top 5 talent
    top5_shared = [s for s in shared if s["rank_a"] <= 5 and s["rank_b"] <= 5]
    if top5_shared:
        tips.append(COLLABORATION_TIPS_PL["both_top5_same"])

    # Tip: shared domain strength
    for domain in ["executing", "influencing", "relationship_building", "strategic_thinking"]:
        key = domain.split("_")[0]  # executing, influencing, relationship, strategic
        if domains_a.get(domain, 0) >= 2 and domains_b.get(domain, 0) >= 2:
            tip_key = f"shared_{key}"
            if tip_key in COLLABORATION_TIPS_PL and COLLABORATION_TIPS_PL[tip_key] not in tips:
                tips.append(COLLABORATION_TIPS_PL[tip_key])

    # Tip: complementary domains
    complement_pairs = [
        ("executing", "strategic_thinking", "complement_exec_strat"),
        ("influencing", "relationship_building", "complement_infl_rel"),
        ("executing", "relationship_building", "complement_exec_rel"),
        ("influencing", "strategic_thinking", "complement_infl_strat"),
    ]
    for d1, d2, tip_key in complement_pairs:
        a_has_d1 = domains_a.get(d1, 0) >= 2
        b_has_d2 = domains_b.get(d2, 0) >= 2
        a_has_d2 = domains_a.get(d2, 0) >= 2
        b_has_d1 = domains_b.get(d1, 0) >= 2
        if (a_has_d1 and b_has_d2) or (a_has_d2 and b_has_d1):
            if COLLABORATION_TIPS_PL[tip_key] not in tips:
                tips.append(COLLABORATION_TIPS_PL[tip_key])

    # Tip: all 4 domains covered together
    if len(all_domains) == 4:
        tips.append(COLLABORATION_TIPS_PL["balance_all_domains"])

    # Ensure 3-5 tips
    return tips[:5] if len(tips) > 5 else tips


def compare_users(
    db: Session,
    user_a: User,
    user_b: User,
    language: str = "pl",
) -> dict:
    """Compare two users' talents and return structured analysis."""
    talents_a = get_user_talents_for_compare(db, user_a.id, language, limit=15)
    talents_b = get_user_talents_for_compare(db, user_b.id, language, limit=15)

    codes_a = {t["code"] for t in talents_a}
    codes_b = {t["code"] for t in talents_b}

    # Shared talents (bridges)
    shared_codes = codes_a & codes_b
    shared = []
    for code in shared_codes:
        ta = next(t for t in talents_a if t["code"] == code)
        tb = next(t for t in talents_b if t["code"] == code)
        shared.append({
            "code": code,
            "name": ta["name"],
            "domain": ta["domain"],
            "rank_a": ta["rank"],
            "rank_b": tb["rank"],
        })
    shared.sort(key=lambda s: s["rank_a"] + s["rank_b"])

    # Unique talents
    unique_a = [t for t in talents_a if t["code"] not in shared_codes]
    unique_b = [t for t in talents_b if t["code"] not in shared_codes]

    # Domain balance
    domains_a = _domain_counts(talents_a)
    domains_b = _domain_counts(talents_b)
    all_domains = ["executing", "influencing", "relationship_building", "strategic_thinking"]
    domain_balance = [
        {
            "domain": d,
            "domain_label": DOMAIN_LABELS.get(d, d),
            "count_a": domains_a.get(d, 0),
            "count_b": domains_b.get(d, 0),
        }
        for d in all_domains
    ]

    # Synergy score
    score = _synergy_score(shared, talents_a, talents_b)

    # Collaboration tips
    tips = _generate_tips(shared, talents_a, talents_b, domain_balance)

    return {
        "shared_talents": shared,
        "unique_a": unique_a,
        "unique_b": unique_b,
        "domain_balance": domain_balance,
        "synergy_score": score,
        "collaboration_tips": tips,
    }
