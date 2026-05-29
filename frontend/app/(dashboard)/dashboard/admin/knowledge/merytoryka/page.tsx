"use client";

import { useTranslations } from "next-intl";
import { KnowledgeEntryManager } from "@/components/knowledge/KnowledgeEntryManager";

export default function KnowledgeMerytorykaPage() {
    const t = useTranslations('admin.knowledge');
    return (
        <KnowledgeEntryManager
            section="merytoryka"
            title={t('merytorykaTitle')}
            description={t('merytorykaDesc')}
        />
    );
}
