"use client";

import { KnowledgeEntryManager } from "@/components/knowledge/KnowledgeEntryManager";

export default function KnowledgeFaqPage() {
    return (
        <KnowledgeEntryManager
            section="faq"
            title="FAQ"
            description="Zarządzaj odpowiedziami na najczęstsze pytania użytkowników. Każdy wpis jest zapisany w Markdown i wspiera modele w udzielaniu spójnych odpowiedzi."
        />
    );
}
