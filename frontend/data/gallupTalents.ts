import { GallupTalent, GallupDomain } from '@/types/talent';

export const DOMAIN_LABELS: Record<GallupDomain, { en: string; pl: string }> = {
    executing: { en: 'Executing', pl: 'Realizacja' },
    influencing: { en: 'Influencing', pl: 'Wpływanie' },
    relationship: { en: 'Relationship Building', pl: 'Budowanie relacji' },
    strategic: { en: 'Strategic Thinking', pl: 'Myślenie strategiczne' },
};

export const DOMAIN_COLORS: Record<GallupDomain, string> = {
    executing: 'domain-executing',
    influencing: 'domain-influencing',
    relationship: 'domain-relationship',
    strategic: 'domain-strategic',
};

export const GALLUP_TALENTS: GallupTalent[] = [
    // Executing Domain (9 talents)
    { id: 'achiever', name: 'Achiever', namePl: 'Osiąganie', domain: 'executing', description: 'Great stamina for hard work', descriptionPl: 'Wielka wytrzymałość w ciężkiej pracy' },
    { id: 'arranger', name: 'Arranger', namePl: 'Organizator', domain: 'executing', description: 'Organizes and orchestrates', descriptionPl: 'Organizuje i koordynuje' },
    { id: 'belief', name: 'Belief', namePl: 'Przekonania', domain: 'executing', description: 'Core values are unchanging', descriptionPl: 'Podstawowe wartości są niezmienne' },
    { id: 'consistency', name: 'Consistency', namePl: 'Bezstronność', domain: 'executing', description: 'Treats everyone equally', descriptionPl: 'Traktuje wszystkich równo' },
    { id: 'deliberative', name: 'Deliberative', namePl: 'Rozwaga', domain: 'executing', description: 'Careful decision making', descriptionPl: 'Uważne podejmowanie decyzji' },
    { id: 'discipline', name: 'Discipline', namePl: 'Dyscyplina', domain: 'executing', description: 'Creates order and structure', descriptionPl: 'Tworzy porządek i strukturę' },
    { id: 'focus', name: 'Focus', namePl: 'Ukierunkowanie', domain: 'executing', description: 'Sets priorities and stays on course', descriptionPl: 'Ustala priorytety i trzyma się kursu' },
    { id: 'responsibility', name: 'Responsibility', namePl: 'Odpowiedzialność', domain: 'executing', description: 'Takes ownership', descriptionPl: 'Bierze odpowiedzialność' },
    { id: 'restorative', name: 'Restorative', namePl: 'Naprawianie', domain: 'executing', description: 'Solves problems', descriptionPl: 'Rozwiązuje problemy' },

    // Influencing Domain (8 talents)
    { id: 'activator', name: 'Activator', namePl: 'Aktywator', domain: 'influencing', description: 'Turns thoughts into action', descriptionPl: 'Zamienia myśli w działanie' },
    { id: 'command', name: 'Command', namePl: 'Dowodzenie', domain: 'influencing', description: 'Takes charge', descriptionPl: 'Przejmuje dowodzenie' },
    { id: 'communication', name: 'Communication', namePl: 'Komunikatywność', domain: 'influencing', description: 'Expresses thoughts effectively', descriptionPl: 'Skutecznie wyraża myśli' },
    { id: 'competition', name: 'Competition', namePl: 'Rywalizacja', domain: 'influencing', description: 'Strives to win', descriptionPl: 'Dąży do wygranej' },
    { id: 'maximizer', name: 'Maximizer', namePl: 'Maksymalista', domain: 'influencing', description: 'Focuses on strengths', descriptionPl: 'Skupia się na mocnych stronach' },
    { id: 'self-assurance', name: 'Self-Assurance', namePl: 'Wiara w siebie', domain: 'influencing', description: 'Confidence in abilities', descriptionPl: 'Pewność swoich umiejętności' },
    { id: 'significance', name: 'Significance', namePl: 'Znaczenie', domain: 'influencing', description: 'Wants to be important', descriptionPl: 'Chce być znaczący' },
    { id: 'woo', name: 'Woo', namePl: 'Czar', domain: 'influencing', description: 'Wins others over', descriptionPl: 'Zjednuje innych' },

    // Relationship Building Domain (9 talents)
    { id: 'adaptability', name: 'Adaptability', namePl: 'Elastyczność', domain: 'relationship', description: 'Goes with the flow', descriptionPl: 'Płynie z prądem' },
    { id: 'connectedness', name: 'Connectedness', namePl: 'Bliskość', domain: 'relationship', description: 'Believes in links between things', descriptionPl: 'Wierzy w powiązania między rzeczami' },
    { id: 'developer', name: 'Developer', namePl: 'Rozwijanie innych', domain: 'relationship', description: 'Sees potential in others', descriptionPl: 'Dostrzega potencjał w innych' },
    { id: 'empathy', name: 'Empathy', namePl: 'Empatia', domain: 'relationship', description: 'Senses others feelings', descriptionPl: 'Wyczuwa uczucia innych' },
    { id: 'harmony', name: 'Harmony', namePl: 'Zgodność', domain: 'relationship', description: 'Seeks consensus', descriptionPl: 'Szuka konsensusu' },
    { id: 'includer', name: 'Includer', namePl: 'Włączanie', domain: 'relationship', description: 'Includes everyone', descriptionPl: 'Włącza wszystkich' },
    { id: 'individualization', name: 'Individualization', namePl: 'Indywidualizacja', domain: 'relationship', description: 'Sees uniqueness in each person', descriptionPl: 'Dostrzega unikalność każdej osoby' },
    { id: 'positivity', name: 'Positivity', namePl: 'Pozytywność', domain: 'relationship', description: 'Enthusiastic and energizing', descriptionPl: 'Entuzjastyczny i energetyzujący' },
    { id: 'relator', name: 'Relator', namePl: 'Relacyjność', domain: 'relationship', description: 'Deep relationships', descriptionPl: 'Głębokie relacje' },

    // Strategic Thinking Domain (8 talents)
    { id: 'analytical', name: 'Analytical', namePl: 'Analityk', domain: 'strategic', description: 'Searches for reasons and causes', descriptionPl: 'Szuka przyczyn i powodów' },
    { id: 'context', name: 'Context', namePl: 'Kontekst', domain: 'strategic', description: 'Looks back to understand present', descriptionPl: 'Patrzy wstecz, by zrozumieć teraźniejszość' },
    { id: 'futuristic', name: 'Futuristic', namePl: 'Wizjoner', domain: 'strategic', description: 'Inspired by the future', descriptionPl: 'Zainspirowany przyszłością' },
    { id: 'ideation', name: 'Ideation', namePl: 'Pomysłowość', domain: 'strategic', description: 'Fascinated by ideas', descriptionPl: 'Zafascynowany pomysłami' },
    { id: 'input', name: 'Input', namePl: 'Zbieranie', domain: 'strategic', description: 'Collects information', descriptionPl: 'Zbiera informacje' },
    { id: 'intellection', name: 'Intellection', namePl: 'Intelekt', domain: 'strategic', description: 'Deep thinking', descriptionPl: 'Głębokie myślenie' },
    { id: 'learner', name: 'Learner', namePl: 'Uczenie się', domain: 'strategic', description: 'Loves to learn', descriptionPl: 'Uwielbia się uczyć' },
    { id: 'strategic', name: 'Strategic', namePl: 'Strateg', domain: 'strategic', description: 'Creates alternative paths', descriptionPl: 'Tworzy alternatywne ścieżki' },
];

export const getTalentsByDomain = (domain: GallupDomain): GallupTalent[] => {
    return GALLUP_TALENTS.filter(t => t.domain === domain);
};

export const getTalentById = (id: string): GallupTalent | undefined => {
    return GALLUP_TALENTS.find(t => t.id === id);
};
