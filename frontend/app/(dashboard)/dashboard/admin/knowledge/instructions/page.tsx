"use client";

import { useTranslations } from "next-intl";
import { KnowledgeEntryManager } from "@/components/knowledge/KnowledgeEntryManager";

export default function KnowledgeInstructionsPage() {
    const t = useTranslations('admin.knowledge');
    return (
        <KnowledgeEntryManager
            section="instructions"
            title={t('instructionsTitle')}
            description={t('instructionsDesc')}
        />
    );
}
