"use client";

import { KnowledgeEntryManager } from "@/components/knowledge/KnowledgeEntryManager";

export default function KnowledgeInstructionsPage() {
    return (
        <KnowledgeEntryManager
            section="instructions"
            title="Instrukcje odpowiedzi"
            description="Definiuj formaty odpowiedzi AI dla różnych typów pytań. Kategoria = klasa intencji (np. shadow_sides, action_plan)."
        />
    );
}
