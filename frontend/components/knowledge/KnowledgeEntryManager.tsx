"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { api, KnowledgeItem } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/knowledge/TagInput";

interface KnowledgeEntryManagerProps {
    section: "faq" | "merytoryka";
    title: string;
    description: string;
}

interface KnowledgeFormState {
    title: string;
    category: string;
    tags: string[];
    content: string;
    language: string;
}

const DEFAULT_FORM: KnowledgeFormState = {
    title: "",
    category: "",
    tags: [],
    content: "",
    language: "pl",
};

export function KnowledgeEntryManager({ section, title, description }: KnowledgeEntryManagerProps) {
    const [entries, setEntries] = useState<KnowledgeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<KnowledgeFormState>(DEFAULT_FORM);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<KnowledgeFormState>(DEFAULT_FORM);
    const fetchEntries = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.admin.listKnowledge(section);
            setEntries(data);
        } catch (error) {
            console.error("Failed to fetch knowledge entries:", error);
        } finally {
            setLoading(false);
        }
    }, [section]);

    useEffect(() => {
        void fetchEntries();
    }, [fetchEntries]);

    const categorySuggestions = useMemo(() => {
        const categories = entries.map((entry) => entry.category).filter(Boolean);
        return Array.from(new Set(categories));
    }, [entries]);

    const tagSuggestions = useMemo(() => {
        const tags = entries.flatMap((entry) => entry.tags || []);
        return Array.from(new Set(tags));
    }, [entries]);

    const resetForm = () => setForm(DEFAULT_FORM);

    const handleCreate = async () => {
        if (!form.title || !form.category || !form.content) {
            return;
        }
        try {
            setSaving(true);
            const created = await api.admin.createKnowledge({
                title: form.title,
                category: form.category,
                tags: form.tags,
                section,
                content: form.content,
                language: form.language,
            });
            setEntries((prev) => [created, ...prev]);
            resetForm();
        } catch (error) {
            console.error("Failed to create knowledge entry:", error);
        } finally {
            setSaving(false);
        }
    };

    const startEditing = (entry: KnowledgeItem) => {
        setEditingId(entry.id);
        setEditForm({
            title: entry.title,
            category: entry.category,
            tags: entry.tags ?? [],
            content: entry.content,
            language: entry.language,
        });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditForm(DEFAULT_FORM);
    };

    const handleUpdate = async (entryId: number) => {
        if (!editForm.title || !editForm.category || !editForm.content) {
            return;
        }
        try {
            setSaving(true);
            const updated = await api.admin.updateKnowledge(entryId, {
                title: editForm.title,
                category: editForm.category,
                tags: editForm.tags,
                content: editForm.content,
                language: editForm.language,
            });
            setEntries((prev) => prev.map((entry) => (entry.id === entryId ? updated : entry)));
            cancelEditing();
        } catch (error) {
            console.error("Failed to update knowledge entry:", error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            <header className="space-y-2">
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {entries.length} wpisów
                    </Badge>
                </div>
                <p className="text-slate-500 max-w-2xl">{description}</p>
            </header>

            <Card className="border-slate-200/70 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-xl">Dodaj nowy wpis</CardTitle>
                    <CardDescription>
                        Każda aktualizacja treści generuje nowe embeddingi i wzmacnia bazę wiedzy.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Tytuł</label>
                            <Input
                                value={form.title}
                                onChange={(event) => setForm({ ...form, title: event.target.value })}
                                placeholder="Np. Jak udzielać feedbacku?"
                                className="bg-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Kategoria</label>
                            <Input
                                value={form.category}
                                onChange={(event) => setForm({ ...form, category: event.target.value })}
                                placeholder="Np. Feedback, Motywacja"
                                list={`category-suggestions-${section}`}
                                className="bg-white"
                            />
                            <datalist id={`category-suggestions-${section}`}>
                                {categorySuggestions.map((category) => (
                                    <option key={category} value={category} />
                                ))}
                            </datalist>
                        </div>
                    </div>

                    <TagInput
                        label="Tagi"
                        tags={form.tags}
                        suggestions={tagSuggestions}
                        onChange={(tags) => setForm({ ...form, tags })}
                    />

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Treść (Markdown)</label>
                        <Textarea
                            value={form.content}
                            onChange={(event) => setForm({ ...form, content: event.target.value })}
                            placeholder="Opisuj konkretne zachowania, techniki i przykłady."
                            className="min-h-[180px] bg-white"
                        />
                    </div>

                    <div className="flex justify-end">
                        <Button
                            onClick={handleCreate}
                            disabled={saving || !form.title || !form.category || !form.content}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            Dodaj wpis
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Istniejące wpisy</h2>
                    <Button variant="outline" size="sm" onClick={fetchEntries} disabled={loading}>
                        Odśwież
                    </Button>
                </div>

                {loading ? (
                    <Card className="border-dashed border-2 bg-slate-50/50">
                        <CardContent className="py-12 text-center text-slate-500">Ładowanie wpisów...</CardContent>
                    </Card>
                ) : entries.length === 0 ? (
                    <Card className="border-dashed border-2 bg-slate-50/50">
                        <CardContent className="py-12 text-center text-slate-500">
                            Brak wpisów w tej sekcji. Dodaj pierwszy wpis powyżej.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {entries.map((entry) => {
                            const isEditing = editingId === entry.id;
                            return (
                                <Card key={entry.id} className="border-slate-200/70 shadow-sm">
                                    <CardHeader className="space-y-2">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <CardTitle className="text-base text-slate-900">
                                                    {entry.title}
                                                </CardTitle>
                                                <CardDescription className="text-xs uppercase tracking-widest text-slate-400">
                                                    {entry.category}
                                                </CardDescription>
                                            </div>
                                            {!isEditing && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => startEditing(entry)}
                                                >
                                                    Edytuj
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {entry.tags?.map((tag) => (
                                                <Badge key={tag} variant="secondary" className="bg-slate-100 text-slate-600">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {isEditing ? (
                                            <div className="space-y-4">
                                                <div className="grid gap-4 md:grid-cols-2">
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-semibold text-slate-700">Tytuł</label>
                                                        <Input
                                                            value={editForm.title}
                                                            onChange={(event) =>
                                                                setEditForm({ ...editForm, title: event.target.value })
                                                            }
                                                            className="bg-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-semibold text-slate-700">Kategoria</label>
                                                        <Input
                                                            value={editForm.category}
                                                            onChange={(event) =>
                                                                setEditForm({ ...editForm, category: event.target.value })
                                                            }
                                                            list={`category-suggestions-edit-${section}`}
                                                            className="bg-white"
                                                        />
                                                        <datalist id={`category-suggestions-edit-${section}`}>
                                                            {categorySuggestions.map((category) => (
                                                                <option key={category} value={category} />
                                                            ))}
                                                        </datalist>
                                                    </div>
                                                </div>
                                                <TagInput
                                                    label="Tagi"
                                                    tags={editForm.tags}
                                                    suggestions={tagSuggestions}
                                                    onChange={(tags) => setEditForm({ ...editForm, tags })}
                                                />
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-slate-700">
                                                        Treść (Markdown)
                                                    </label>
                                                    <Textarea
                                                        value={editForm.content}
                                                        onChange={(event) =>
                                                            setEditForm({ ...editForm, content: event.target.value })
                                                        }
                                                        className="min-h-[160px] bg-white"
                                                    />
                                                </div>
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    <Button variant="outline" onClick={cancelEditing} disabled={saving}>
                                                        Anuluj
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleUpdate(entry.id)}
                                                        disabled={
                                                            saving ||
                                                            !editForm.title ||
                                                            !editForm.category ||
                                                            !editForm.content
                                                        }
                                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                                    >
                                                        Zapisz zmiany
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 text-sm text-slate-600">
                                                <p className="whitespace-pre-wrap">
                                                    {entry.content}
                                                </p>
                                                {entry.updated_at && (
                                                    <p className="text-xs text-slate-400">
                                                        Ostatnia aktualizacja:{" "}
                                                        {new Date(entry.updated_at).toLocaleString("pl-PL")}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
