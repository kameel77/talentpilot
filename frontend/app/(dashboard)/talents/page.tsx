"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

interface TalentRow {
    id: number;
    name: string;
    domain: string;
    description: string;
    order_number: number | null;
    initialOrderNumber: number | null;
}

export default function TalentsAdminPage() {
    const [talents, setTalents] = useState<TalentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        const loadTalents = async () => {
            try {
                const data = await api.talents.list();
                setTalents(
                    data.map((talent: any) => ({
                        ...talent,
                        order_number: talent.order_number ?? null,
                        initialOrderNumber: talent.order_number ?? null,
                    }))
                );
            } catch (err: any) {
                setError(err.message || "Failed to load talents");
            } finally {
                setLoading(false);
            }
        };

        loadTalents();
    }, []);

    const sortedTalents = useMemo(() => {
        return [...talents].sort((a, b) => {
            if (a.order_number === null && b.order_number === null) {
                return a.name.localeCompare(b.name);
            }
            if (a.order_number === null) return 1;
            if (b.order_number === null) return -1;
            return a.order_number - b.order_number;
        });
    }, [talents]);

    const hasChanges = talents.some(
        (talent) => talent.order_number !== talent.initialOrderNumber
    );

    const handleOrderChange = (id: number, value: string) => {
        const parsed = value === "" ? null : Number(value);
        setTalents((prev) =>
            prev.map((talent) =>
                talent.id === id
                    ? {
                          ...talent,
                          order_number:
                              value === "" || Number.isNaN(parsed) ? null : parsed,
                      }
                    : talent
            )
        );
    };

    const handleSave = async () => {
        setError("");
        setSuccess("");

        const updates = talents
            .filter((talent) => talent.order_number !== talent.initialOrderNumber)
            .map((talent) => ({
                name: talent.name,
                order_number: talent.order_number,
            }));

        if (updates.length === 0) {
            setSuccess("No changes to save.");
            return;
        }

        const invalid = updates.filter(
            (update) =>
                update.order_number !== null &&
                (update.order_number < 1 || update.order_number > 34)
        );
        if (invalid.length > 0) {
            setError("Order numbers must be between 1 and 34.");
            return;
        }

        try {
            setSaving(true);
            const data = await api.talents.updateOrderNumbers(updates);
            setTalents(
                data.map((talent: any) => ({
                    ...talent,
                    order_number: talent.order_number ?? null,
                    initialOrderNumber: talent.order_number ?? null,
                }))
            );
            setSuccess("Order numbers updated successfully.");
        } catch (err: any) {
            setError(err.message || "Failed to update talents");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="text-gray-600">Loading talents...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">
                            Gallup order numbers
                        </h1>
                        <p className="mt-2 text-sm text-slate-500">
                            Wprowadź numer porządkowy z raportu Gallupa, aby
                            uporządkować talenty według priorytetu.
                        </p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {saving ? "Saving..." : "Save changes"}
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {success && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {success}
                </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="grid grid-cols-1 gap-4 border-b border-slate-100 bg-slate-50 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid-cols-[2fr_1fr_1fr]">
                    <span>Talent</span>
                    <span>Domain</span>
                    <span>Order number</span>
                </div>
                <div className="divide-y divide-slate-100">
                    {sortedTalents.map((talent) => (
                        <div
                            key={talent.id}
                            className="grid grid-cols-1 gap-4 px-6 py-4 md:grid-cols-[2fr_1fr_1fr]"
                        >
                            <div>
                                <p className="text-sm font-semibold text-slate-900">
                                    {talent.name}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {talent.description}
                                </p>
                            </div>
                            <div className="text-sm text-slate-600 capitalize">
                                {talent.domain.replace("_", " ")}
                            </div>
                            <div>
                                <input
                                    type="number"
                                    min={1}
                                    max={34}
                                    value={talent.order_number ?? ""}
                                    onChange={(event) =>
                                        handleOrderChange(talent.id, event.target.value)
                                    }
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                    placeholder="1-34"
                                />
                                {talent.order_number !== null &&
                                    (talent.order_number < 1 ||
                                        talent.order_number > 34) && (
                                        <p className="mt-1 text-xs text-red-500">
                                            Number must be 1-34.
                                        </p>
                                    )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {!hasChanges && (
                <p className="text-xs text-slate-400">
                    Wszystkie zmiany zapisane.
                </p>
            )}
        </div>
    );
}
