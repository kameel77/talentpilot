"use client";

import { useTranslations } from "next-intl";
import { KnowledgeEntryManager } from "@/components/knowledge/KnowledgeEntryManager";

export default function KnowledgeFaqPage() {
    const t = useTranslations('admin.knowledge');
    return (
        <KnowledgeEntryManager
            section="faq"
            title={t('faqTitle')}
            description={t('faqDesc')}
        />
    );
}
