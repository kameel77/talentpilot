"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

interface ManualData {
    superpowers?: string;
    motivators?: string;
    blockers?: string;
    feedback_style?: string;
}

export default function UserManualCard({
    data,
    onSave,
}: {
    data: ManualData;
    onSave?: (updated: ManualData) => void;
}) {
    const t = useTranslations('myTalents');
    const tCommon = useTranslations('common');
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState<ManualData>(data);

    const handleChange = (field: keyof ManualData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        onSave?.(formData);
        setEditing(false);
    };

    const fields: { key: keyof ManualData; label: string; placeholder: string }[] = [
        {
            key: "superpowers",
            label: t('superpowersTitle'),
            placeholder: t('superpowersPlaceholder'),
        },
        {
            key: "motivators",
            label: t('motivatorsTitle'),
            placeholder: t('motivatorsPlaceholder'),
        },
        {
            key: "blockers",
            label: t('blockersTitle'),
            placeholder: t('blockersPlaceholder'),
        },
        {
            key: "feedback_style",
            label: t('feedbackStyleTitle'),
            placeholder: t('feedbackStylePlaceholder'),
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                    {t('userManual')}
                </h3>
                <button
                    onClick={() => setEditing((prev) => !prev)}
                    className="rounded-full border border-slate-200 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                >
                    {editing ? tCommon('cancel') : t('editManual')}
                </button>
            </div>

            <div className="mt-5 grid gap-4">
                {fields.map((field) => (
                    <div key={field.key} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {field.label}
                        </p>
                        {editing ? (
                            <textarea
                                className="min-h-[80px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                                placeholder={field.placeholder}
                                value={formData[field.key] || ""}
                                onChange={(event) =>
                                    handleChange(field.key, event.target.value)
                                }
                            />
                        ) : (
                            <p className="text-sm text-slate-700">
                                {formData[field.key] || t('manualEmpty')}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            {editing && (
                <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                        onClick={() => setEditing(false)}
                        className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-300"
                    >
                        {tCommon('cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-indigo-700"
                    >
                        {t('saveManual')}
                    </button>
                </div>
            )}
        </motion.div>
    );
}
