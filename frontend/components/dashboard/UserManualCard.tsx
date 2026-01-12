"use client";

import { useState } from "react";
import { motion } from "framer-motion";

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
            label: "Superpowers",
            placeholder: "What are the natural strengths you bring to the team?",
        },
        {
            key: "motivators",
            label: "Motivators",
            placeholder: "What fuels your energy and engagement?",
        },
        {
            key: "blockers",
            label: "Blockers",
            placeholder: "What creates friction or drains you?",
        },
        {
            key: "feedback_style",
            label: "Feedback Style",
            placeholder: "How do you prefer to receive feedback?",
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
                    User Manual
                </h3>
                <button
                    onClick={() => setEditing((prev) => !prev)}
                    className="rounded-full border border-slate-200 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                >
                    {editing ? "Cancel" : "Edit"}
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
                                {formData[field.key] || "Not set yet"}
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
                        Discard
                    </button>
                    <button
                        onClick={handleSave}
                        className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-indigo-700"
                    >
                        Save changes
                    </button>
                </div>
            )}
        </motion.div>
    );
}
