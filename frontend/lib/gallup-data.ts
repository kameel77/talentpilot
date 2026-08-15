/**
 * Complete list of 34 CliftonStrengths talents organized by domain.
 * Used for seeding, display, and analysis throughout the application.
 */

export type GallupDomain = 'executing' | 'influencing' | 'relationship_building' | 'strategic_thinking';

export interface GallupTalent {
    code: string;
    en: string;
    pl: string;
    en_desc?: string;
    pl_desc?: string;
    domain: GallupDomain;
}

export const DOMAIN_COLORS: Record<GallupDomain, string> = {
    executing: '#6B33CC',
    influencing: '#F97415',
    relationship_building: '#1A80E6',
    strategic_thinking: '#1FAD91',
};

/**
 * CSS Variable names for domains (matching globals.css)
 */
export const DOMAIN_VAR_MAP: Record<GallupDomain, string> = {
    executing: 'var(--color-domain-executing)',
    influencing: 'var(--color-domain-influencing)',
    relationship_building: 'var(--color-domain-relationship)',
    strategic_thinking: 'var(--color-domain-strategic)',
};

/**
 * Helper to get domain color as CSS variable or color-mix for transparency
 */
export function getDomainStyle(domain: GallupDomain, opacity: number = 100): string {
    const varName = DOMAIN_VAR_MAP[domain];
    if (opacity === 100) return varName;
    return `color-mix(in srgb, ${varName} ${opacity}%, transparent)`;
}

/**
 * Maps canonical domain names to short CSS class keys used in globals.css.
 * Use this when building dynamic CSS class names like `domain-${cssKey}`.
 */
export const DOMAIN_CSS_KEY: Record<GallupDomain, string> = {
    executing: 'executing',
    influencing: 'influencing',
    relationship_building: 'relationship',
    strategic_thinking: 'strategic',
};

export const DOMAIN_LABELS: Record<GallupDomain, { en: string; pl: string }> = {
    executing: { en: 'Executing', pl: 'Wykonywanie' },
    influencing: { en: 'Influencing', pl: 'Wywieranie wpływu' },
    relationship_building: { en: 'Relationship Building', pl: 'Budowanie relacji' },
    strategic_thinking: { en: 'Strategic Thinking', pl: 'Myślenie strategiczne' },
};

export const GALLUP_TALENTS: GallupTalent[] = [
    // Executing
        { code: 'achiever', en: 'Achiever', pl: 'Osiąganie', en_desc: 'Great stamina for hard work', pl_desc: 'Wielka wytrzymałość w ciężkiej pracy', domain: 'executing' },
        { code: 'arranger', en: 'Arranger', pl: 'Organizator', en_desc: 'Organizes and orchestrates', pl_desc: 'Organizuje i koordynuje', domain: 'executing' },
        { code: 'belief', en: 'Belief', pl: 'Pryncypialność', en_desc: 'Core values are unchanging', pl_desc: 'Podstawowe wartości są niezmienne', domain: 'executing' },
        { code: 'consistency', en: 'Consistency', pl: 'Sprawiedliwość', en_desc: 'Treats everyone equally', pl_desc: 'Traktuje wszystkich równo', domain: 'executing' },
        { code: 'deliberative', en: 'Deliberative', pl: 'Rozwaga', en_desc: 'Careful decision making', pl_desc: 'Uważne podejmowanie decyzji', domain: 'executing' },
        { code: 'discipline', en: 'Discipline', pl: 'Dyscyplina', en_desc: 'Creates order and structure', pl_desc: 'Tworzy porządek i strukturę', domain: 'executing' },
        { code: 'focus', en: 'Focus', pl: 'Ukierunkowanie', en_desc: 'Sets priorities and stays on course', pl_desc: 'Ustala priorytety i trzyma się kursu', domain: 'executing' },
        { code: 'responsibility', en: 'Responsibility', pl: 'Odpowiedzialność', en_desc: 'Takes ownership', pl_desc: 'Bierze odpowiedzialność', domain: 'executing' },
        { code: 'restorative', en: 'Restorative', pl: 'Naprawianie', en_desc: 'Solves problems', pl_desc: 'Rozwiązuje problemy', domain: 'executing' },

    // Influencing
        { code: 'activator', en: 'Activator', pl: 'Aktywator', en_desc: 'Turns thoughts into action', pl_desc: 'Zamienia myśli w działanie', domain: 'influencing' },
        { code: 'command', en: 'Command', pl: 'Dowodzenie', en_desc: 'Takes charge', pl_desc: 'Przejmuje dowodzenie', domain: 'influencing' },
        { code: 'communication', en: 'Communication', pl: 'Komunikatywność', en_desc: 'Expresses thoughts effectively', pl_desc: 'Skutecznie wyraża myśli', domain: 'influencing' },
        { code: 'competition', en: 'Competition', pl: 'Rywalizacja', en_desc: 'Strives to win', pl_desc: 'Dąży do wygranej', domain: 'influencing' },
        { code: 'maximizer', en: 'Maximizer', pl: 'Maksymalista', en_desc: 'Focuses on strengths', pl_desc: 'Skupia się na mocnych stronach', domain: 'influencing' },
        { code: 'self-assurance', en: 'Self-Assurance', pl: 'Pewność siebie', en_desc: 'Confidence in abilities', pl_desc: 'Pewność swoich umiejętności', domain: 'influencing' },
        { code: 'significance', en: 'Significance', pl: 'Poważanie', en_desc: 'Wants to be important', pl_desc: 'Chce być znaczący', domain: 'influencing' },
        { code: 'woo', en: 'Woo', pl: 'Czar', en_desc: 'Wins others over', pl_desc: 'Zjednuje innych', domain: 'influencing' },

    // Relationship Building
        { code: 'adaptability', en: 'Adaptability', pl: 'Elastyczność', en_desc: 'Goes with the flow', pl_desc: 'Płynie z prądem', domain: 'relationship_building' },
        { code: 'connectedness', en: 'Connectedness', pl: 'Współzależność', en_desc: 'Believes in links between things', pl_desc: 'Wierzy w powiązania między rzeczami', domain: 'relationship_building' },
        { code: 'developer', en: 'Developer', pl: 'Rozwijanie', en_desc: 'Sees potential in others', pl_desc: 'Dostrzega potencjał w innych', domain: 'relationship_building' },
        { code: 'empathy', en: 'Empathy', pl: 'Empatia', en_desc: 'Senses others feelings', pl_desc: 'Wyczuwa uczucia innych', domain: 'relationship_building' },
        { code: 'harmony', en: 'Harmony', pl: 'Zgodność', en_desc: 'Seeks consensus', pl_desc: 'Szuka konsensusu', domain: 'relationship_building' },
        { code: 'includer', en: 'Includer', pl: 'Integrator', en_desc: 'Includes everyone', pl_desc: 'Włącza wszystkich', domain: 'relationship_building' },
        { code: 'individualization', en: 'Individualization', pl: 'Indywidualizacja', en_desc: 'Sees uniqueness in each person', pl_desc: 'Dostrzega unikalność każdej osoby', domain: 'relationship_building' },
        { code: 'positivity', en: 'Positivity', pl: 'Optymista', en_desc: 'Enthusiastic and energizing', pl_desc: 'Entuzjastyczny i energetyzujący', domain: 'relationship_building' },
        { code: 'relator', en: 'Relator', pl: 'Bliskość', en_desc: 'Deep relationships', pl_desc: 'Głębokie relacje', domain: 'relationship_building' },

    // Strategic Thinking
        { code: 'analytical', en: 'Analytical', pl: 'Analityk', en_desc: 'Searches for reasons and causes', pl_desc: 'Szuka przyczyn i powodów', domain: 'strategic_thinking' },
        { code: 'context', en: 'Context', pl: 'Kontekst', en_desc: 'Looks back to understand present', pl_desc: 'Patrzy wstecz, by zrozumieć teraźniejszość', domain: 'strategic_thinking' },
        { code: 'futuristic', en: 'Futuristic', pl: 'Wizjoner', en_desc: 'Inspired by the future', pl_desc: 'Zainspirowany przyszłością', domain: 'strategic_thinking' },
        { code: 'ideation', en: 'Ideation', pl: 'Odkrywczość', en_desc: 'Fascinated by ideas', pl_desc: 'Zafascynowany pomysłami', domain: 'strategic_thinking' },
        { code: 'input', en: 'Input', pl: 'Zbieranie', en_desc: 'Collects information', pl_desc: 'Zbiera informacje', domain: 'strategic_thinking' },
        { code: 'intellection', en: 'Intellection', pl: 'Intelekt', en_desc: 'Deep thinking', pl_desc: 'Głębokie myślenie', domain: 'strategic_thinking' },
        { code: 'learner', en: 'Learner', pl: 'Uczenie się', en_desc: 'Loves to learn', pl_desc: 'Uwielbia się uczyć', domain: 'strategic_thinking' },
        { code: 'strategic', en: 'Strategic', pl: 'Strateg', en_desc: 'Creates alternative paths', pl_desc: 'Tworzy alternatywne ścieżki', domain: 'strategic_thinking' },
];

/**
 * Get talent by code
 */
export function getTalentByCode(code: string): GallupTalent | undefined {
    return GALLUP_TALENTS.find(t => t.code === code);
}

/**
 * Get all talents for a specific domain
 */
export function getTalentsByDomain(domain: GallupDomain): GallupTalent[] {
    return GALLUP_TALENTS.filter(t => t.domain === domain);
}
