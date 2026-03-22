"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Search, X } from "lucide-react";

import { api, KnowledgeItem } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/knowledge/TagInput";

interface KnowledgeEntryManagerProps {
    section: "faq" | "merytoryka" | "instructions";
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
    { value: "neurodiversity", label: "Neurodiversity" },
    { value: "intent_prompt", label: "Instrukcja intencji (Intent Prompt)" },
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
    neurodiversity: "Neurodiversity",
    intent_prompt: "Intent Prompt",
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
    renderMode: string;
}

const DEFAULT_FORM: KnowledgeFormState = {
    title: "",
    category: "",
    tags: [],
    content: "",
    language: "pl",
    domain: "",
    contentType: "",
    renderMode: "",
};

// --- Helpers ---

function buildMetadataJson(form: KnowledgeFormState): Record<string, unknown> {
    const meta: Record<string, unknown> = {};
    if (form.domain) meta.domain = form.domain;
    if (form.contentType) meta.content_type = form.contentType;
    if (form.renderMode) meta.render_mode = form.renderMode;
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
        renderMode: meta.render_mode || "",
    };
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function matchesSearch(entry: KnowledgeItem, query: string): boolean {
    const q = query.toLowerCase();
    const meta = (entry.metadata_json || {}) as Record<string, string>;
    const domainLabel = DOMAIN_LABEL_MAP[meta.domain] || meta.domain || "";
    const contentTypeLabel = CONTENT_TYPE_LABEL_MAP[meta.content_type] || meta.content_type || "";
    return (
        entry.title.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        entry.content.toLowerCase().includes(q) ||
        domainLabel.toLowerCase().includes(q) ||
        contentTypeLabel.toLowerCase().includes(q) ||
        (entry.tags || []).some((t) => t.toLowerCase().includes(q))
    );
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
        <>
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
        </>
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

            {/* Row 2.5: Render Mode (only for instructions section) */}
            {section.includes("instructions") && (
                <div className="grid gap-4 md:grid-cols-3">
                    <FormSelect
                        label="Tryb renderowania"
                        value={form.renderMode}
                        onChange={(value) => setForm({ ...form, renderMode: value })}
                        options={[
                            { value: "", label: "— domyślny (structured) —" },
                            { value: "structured", label: "Structured (Talent/Kompetencja/Akcja)" },
                            { value: "freeform", label: "Freeform (swobodny tekst)" },
                        ]}
                    />
                </div>
            )}

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

    // UI state
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");

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

    const filteredEntries = useMemo(() => {
        if (!searchQuery.trim()) return entries;
        return entries.filter((entry) => matchesSearch(entry, searchQuery));
    }, [entries, searchQuery]);

    const resetForm = () => setForm(DEFAULT_FORM);

    const toggleExpanded = (id: number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
                // Cancel editing if collapsing
                if (editingId === id) {
                    setEditingId(null);
                    setEditForm(DEFAULT_FORM);
                }
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleCreate = async () => {
        if (!form.title || !form.category || !form.content) return;
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
            setShowCreateForm(false);
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
        if (!editForm.title || !editForm.category || !editForm.content) return;
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
        <div className="space-y-6">
            {/* Header */}
            <header className="space-y-2">
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {entries.length} wpisów
                    </Badge>
                </div>
                <p className="text-slate-500 max-w-2xl">{description}</p>
            </header>

            {/* Action bar: Add button + Search */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                    onClick={() => setShowCreateForm((prev) => !prev)}
                    className={showCreateForm
                        ? "bg-slate-600 hover:bg-slate-700 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }
                >
                    {showCreateForm ? (
                        <>
                            <X className="h-4 w-4 mr-2" />
                            Zamknij formularz
                        </>
                    ) : (
                        <>
                            <Plus className="h-4 w-4 mr-2" />
                            Dodaj nową treść
                        </>
                    )}
                </Button>

                <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Szukaj po tytule, kategorii, domenie, treści..."
                        className="pl-9 bg-white"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Create Form (collapsible) */}
            {showCreateForm && (
                <Card className="border-slate-200/70 shadow-sm border-blue-200/50">
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
            )}

            {/* Entries list */}
            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">
                        Istniejące wpisy
                        {searchQuery && (
                            <span className="ml-2 text-sm font-normal text-slate-400">
                                ({filteredEntries.length} z {entries.length})
                            </span>
                        )}
                    </h2>
                    <Button variant="outline" size="sm" onClick={fetchEntries} disabled={loading}>
                        Odśwież
                    </Button>
                </div>

                {loading ? (
                    <Card className="border-dashed border-2 bg-slate-50/50">
                        <CardContent className="py-12 text-center text-slate-500">Ładowanie wpisów...</CardContent>
                    </Card>
                ) : filteredEntries.length === 0 ? (
                    <Card className="border-dashed border-2 bg-slate-50/50">
                        <CardContent className="py-12 text-center text-slate-500">
                            {searchQuery
                                ? "Brak wpisów pasujących do wyszukiwania."
                                : "Brak wpisów w tej sekcji. Dodaj pierwszy wpis powyżej."}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-2">
                        {filteredEntries.map((entry) => {
                            const isExpanded = expandedIds.has(entry.id);
                            const isEditing = editingId === entry.id;
                            const meta = (entry.metadata_json || {}) as Record<string, unknown>;

                            return (
                                <Card key={entry.id} className="border-slate-200/70 shadow-sm overflow-hidden">
                                    {/* Collapsed header — always visible */}
                                    <button
                                        onClick={() => toggleExpanded(entry.id)}
                                        className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/80 transition-colors"
                                    >
                                        {isExpanded ? (
                                            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                                        )}
                                        <span className="font-medium text-sm text-slate-900 truncate flex-1">
                                            {entry.title}
                                        </span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <MetadataBadges metadata={meta} />
                                            <Badge variant="secondary" className="text-[10px] font-bold">
                                                {entry.language.toUpperCase()}
                                            </Badge>
                                            <span className="text-[10px] text-slate-400 ml-1 hidden sm:inline">
                                                {formatDate(entry.updated_at || entry.created_at)}
                                            </span>
                                        </div>
                                    </button>

                                    {/* Expanded content */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100">
                                            <CardHeader className="pb-2 pt-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="space-y-1">
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
                                                <div className="flex flex-wrap gap-1.5 mt-1">
                                                    {entry.tags?.map((tag) => (
                                                        <Badge key={tag} variant="secondary" className="bg-slate-100 text-slate-600 text-[10px]">
                                                            {tag}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-4 pb-5">
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
                                                    <div className="space-y-3">
                                                        <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                                                            {entry.content}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1 border-t border-slate-50">
                                                            <span>Utworzono: {formatDate(entry.created_at)}</span>
                                                            {entry.updated_at && (
                                                                <span>• Zaktualizowano: {formatDate(entry.updated_at)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
