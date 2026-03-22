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

// --- Constants ---

const DOMAIN_OPTIONS = [
    { value: "", label: "— brak —" },
    { value: "executing", label: "Realizacja (Executing)" },
    { value: "influencing", label: "Wywieranie wpływu (Influencing)" },
    { value: "relationship_building", label: "Budowanie relacji (Relationship Building)" },
    { value: "strategic_thinking", label: "Myślenie strategiczne (Strategic Thinking)" },
] as const;

const CONTENT_TYPE_OPTIONS = [
    { value: "", label: "— brak —" },
    { value: "profile", label: "Profil talentu" },
    { value: "strengths", label: "Siła / Ograniczenia (Balkon/Piwnica)" },
    { value: "motivation", label: "Motywacja / Demotywacja" },
    { value: "communication", label: "Styl komunikacji" },
    { value: "partnerships", label: "Partnerstwa z innymi talentami" },
    { value: "roles", label: "Idealne role i projekty" },
    { value: "qa", label: "Q&A" },
    { value: "dynamics", label: "Dynamika między talentami" },
    { value: "analysis_process", label: "Proces analizy" },
    { value: "other", label: "Inny" },
] as const;

const LANGUAGE_OPTIONS = [
    { value: "pl", label: "🇵🇱 PL" },
    { value: "en", label: "🇬🇧 EN" },
    { value: "de", label: "🇩🇪 DE" },
    { value: "es", label: "🇪🇸 ES" },
    { value: "fr", label: "🇫🇷 FR" },
] as const;

const DOMAIN_LABEL_MAP: Record<string, string> = {
    executing: "Realizacja",
    influencing: "Wpływ",
    relationship_building: "Relacje",
    strategic_thinking: "Strategia",
};

const CONTENT_TYPE_LABEL_MAP: Record<string, string> = {
    profile: "Profil",
    strengths: "Siła/Piwnica",
    motivation: "Motywacja",
    communication: "Komunikacja",
    partnerships: "Partnerstwa",
    roles: "Role",
    qa: "Q&A",
    dynamics: "Dynamika",
    analysis_process: "Analiza",
    other: "Inny",
};

// --- Types ---

interface KnowledgeFormState {
    title: string;
    category: string;
    tags: string[];
    content: string;
    language: string;
    domain: string;
    contentType: string;
}

const DEFAULT_FORM: KnowledgeFormState = {
    title: "",
    category: "",
    tags: [],
    content: "",
    language: "pl",
    domain: "",
    contentType: "",
};

// --- Helpers ---

function buildMetadataJson(form: KnowledgeFormState): Record<string, unknown> {
    const meta: Record<string, unknown> = {};
    if (form.domain) meta.domain = form.domain;
    if (form.contentType) meta.content_type = form.contentType;
    return meta;
}

function extractFormFromEntry(entry: KnowledgeItem): KnowledgeFormState {
    const meta = (entry.metadata_json || {}) as Record<string, string>;
    return {
        title: entry.title,
        category: entry.category,
        tags: entry.tags ?? [],
        content: entry.content,
        language: entry.language,
        domain: meta.domain || "",
        contentType: meta.content_type || "",
    };
}

// --- Shared Select Component ---

function FormSelect({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: readonly { value: string; label: string }[];
}) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

// --- Metadata Badges ---

function MetadataBadges({ metadata }: { metadata: Record<string, unknown> }) {
    const domain = metadata?.domain as string | undefined;
    const contentType = metadata?.content_type as string | undefined;

    if (!domain && !contentType) return null;

    return (
        <div className="flex flex-wrap gap-1.5">
            {domain && (
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                    {DOMAIN_LABEL_MAP[domain] || domain}
                </Badge>
            )}
            {contentType && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                    {CONTENT_TYPE_LABEL_MAP[contentType] || contentType}
                </Badge>
            )}
        </div>
    );
}

// --- Form Fields Component ---

function KnowledgeFormFields({
    form,
    setForm,
    categorySuggestions,
    tagSuggestions,
    section,
}: {
    form: KnowledgeFormState;
    setForm: (updater: KnowledgeFormState | ((prev: KnowledgeFormState) => KnowledgeFormState)) => void;
    categorySuggestions: string[];
    tagSuggestions: string[];
    section: string;
}) {
    return (
        <div className="space-y-5">
            {/* Row 1: Tytuł + Kategoria */}
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
                        placeholder="Np. Talent: Bezstronność"
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

            {/* Row 2: Domena + Typ treści + Język */}
            <div className="grid gap-4 md:grid-cols-3">
                <FormSelect
                    label="Domena (Gallup)"
                    value={form.domain}
                    onChange={(value) => setForm({ ...form, domain: value })}
                    options={DOMAIN_OPTIONS}
                />
                <FormSelect
                    label="Typ treści"
                    value={form.contentType}
                    onChange={(value) => setForm({ ...form, contentType: value })}
                    options={CONTENT_TYPE_OPTIONS}
                />
                <FormSelect
                    label="Język"
                    value={form.language}
                    onChange={(value) => setForm({ ...form, language: value })}
                    options={LANGUAGE_OPTIONS}
                />
            </div>

            {/* Row 3: Tags */}
            <TagInput
                label="Tagi"
                tags={form.tags}
                suggestions={tagSuggestions}
                onChange={(tags) => setForm({ ...form, tags })}
            />

            {/* Row 4: Content */}
            <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Treść (Markdown)</label>
                <Textarea
                    value={form.content}
                    onChange={(event) => setForm({ ...form, content: event.target.value })}
                    placeholder="Opisuj konkretne zachowania, techniki i przykłady."
                    className="min-h-[180px] bg-white"
                />
            </div>
        </div>
    );
}

// --- Main Component ---

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
                metadata_json: buildMetadataJson(form),
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
        setEditForm(extractFormFromEntry(entry));
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
                metadata_json: buildMetadataJson(editForm),
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
                    <KnowledgeFormFields
                        form={form}
                        setForm={setForm as (updater: KnowledgeFormState | ((prev: KnowledgeFormState) => KnowledgeFormState)) => void}
                        categorySuggestions={categorySuggestions}
                        tagSuggestions={tagSuggestions}
                        section={section}
                    />

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
                                                <div className="flex items-center gap-2">
                                                    <CardDescription className="text-xs uppercase tracking-widest text-slate-400">
                                                        {entry.category}
                                                    </CardDescription>
                                                    <Badge variant="secondary" className="text-[10px] font-bold">
                                                        {entry.language.toUpperCase()}
                                                    </Badge>
                                                </div>
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
                                            <MetadataBadges metadata={entry.metadata_json as Record<string, unknown>} />
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
                                                <KnowledgeFormFields
                                                    form={editForm}
                                                    setForm={setEditForm as (updater: KnowledgeFormState | ((prev: KnowledgeFormState) => KnowledgeFormState)) => void}
                                                    categorySuggestions={categorySuggestions}
                                                    tagSuggestions={tagSuggestions}
                                                    section={`edit-${section}`}
                                                />
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
