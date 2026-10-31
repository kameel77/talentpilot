"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2, Upload, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { getLocaleFromCookie } from "@/lib/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { fileBaseName, isPdfFile, parseGallupPdf, TopTalent } from "./parseGallupPdf";
import { AddedPerson, TalentChips } from "./shared";

type ItemStatus = "parsing" | "ready" | "parseError" | "saving" | "saveError";

interface BatchItem {
    id: string;
    fileName: string;
    name: string;
    status: ItemStatus;
    rankings?: Record<string, number>;
    topTalents?: TopTalent[];
    /** Set once the profile exists, so a retry after a failed talent save does not duplicate it. */
    created?: { userId: number; publicToken?: string; publicSlug?: string };
}

interface PdfBatchImportProps {
    teamId: number;
    onAdded: (people: AddedPerson[]) => void;
    onChange?: () => void;
}

/**
 * Drop N Gallup PDFs → parse each → editable review list → add all to a team.
 * Successful rows leave the list immediately; failed rows stay for a retry.
 */
export function PdfBatchImport({ teamId, onAdded, onChange }: PdfBatchImportProps) {
    const t = useTranslations("addClient");
    const inputId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const idCounter = useRef(0);

    const [items, setItems] = useState<BatchItem[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [notice, setNotice] = useState("");
    const [saving, setSaving] = useState(false);

    const updateItem = (id: string, patch: Partial<BatchItem>) =>
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

    const handleFiles = async (fileList: FileList | File[]) => {
        const all = Array.from(fileList);
        const pdfs = all.filter(isPdfFile);
        setNotice(pdfs.length < all.length ? t("onlyPdf") : "");
        if (pdfs.length === 0) return;
        if (!(await api.billing.checkLimit("profiles", pdfs.length))) return;

        const locale = getLocaleFromCookie();
        const newItems: BatchItem[] = pdfs.map((file) => ({
            id: `pdf-${++idCounter.current}`,
            fileName: file.name,
            name: fileBaseName(file),
            status: "parsing",
        }));
        setItems((prev) => [...prev, ...newItems]);

        // Sequential on purpose: keeps backend PDF parsing load predictable.
        for (let i = 0; i < pdfs.length; i++) {
            const item = newItems[i];
            try {
                const parsed = await parseGallupPdf(pdfs[i], locale);
                updateItem(item.id, {
                    name: parsed.name,
                    rankings: parsed.rankings,
                    topTalents: parsed.topTalents,
                    status: "ready",
                });
            } catch {
                updateItem(item.id, { status: "parseError" });
            }
        }
    };

    const readyItems = items.filter((it) => it.status === "ready" || it.status === "saveError");
    const isParsing = items.some((it) => it.status === "parsing");

    const handleAddAll = async () => {
        const toSave = readyItems.filter((it) => it.name.trim());
        if (toSave.length === 0) return;
        const newProfiles = toSave.filter((it) => !it.created).length;
        if (newProfiles > 0 && !(await api.billing.checkLimit("profiles", newProfiles))) return;

        setSaving(true);
        const added: AddedPerson[] = [];
        for (const item of toSave) {
            updateItem(item.id, { status: "saving" });
            let created = item.created;
            try {
                if (!created) {
                    const ghost = await api.invitations.createGhostInvite({
                        full_name: item.name.trim(),
                        team_id: teamId,
                    });
                    created = { userId: ghost.user_id, publicToken: ghost.public_token, publicSlug: ghost.public_slug };
                    updateItem(item.id, { created });
                }
                if (item.rankings && Object.keys(item.rankings).length > 0) {
                    await api.gallup.saveTalents(created.userId, item.rankings);
                }
                added.push({
                    userId: created.userId,
                    fullName: item.name.trim(),
                    publicToken: created.publicToken,
                    publicSlug: created.publicSlug,
                    hasTalents: Boolean(item.rankings && Object.keys(item.rankings).length > 0),
                });
                setItems((prev) => prev.filter((it) => it.id !== item.id));
            } catch {
                updateItem(item.id, { status: "saveError", created });
            }
        }
        setSaving(false);
        if (added.length > 0) {
            onAdded(added);
            onChange?.();
        }
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
    };

    return (
        <div className="space-y-4">
            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                className={cn(
                    "p-6 border-2 border-dashed rounded-2xl text-center transition-colors",
                    dragActive ? "border-primary bg-blue-50/60" : "border-slate-200 hover:border-primary"
                )}
            >
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">
                    {dragActive ? t("dropActive") : t("dropTitle")}
                </p>
                <p className="text-xs text-slate-400 mb-3">{t("dropHelp")}</p>
                <input
                    ref={inputRef}
                    id={inputId}
                    type="file"
                    multiple
                    accept="application/pdf"
                    onChange={(e) => {
                        if (e.target.files) handleFiles(e.target.files);
                        e.target.value = "";
                    }}
                    className="hidden"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                    {t("dropSelect")}
                </Button>
            </div>

            {notice && <p className="text-xs font-medium text-amber-700">{notice}</p>}

            {items.length > 0 && (
                <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        {t("reviewTitle", { count: items.length })}
                    </p>
                    <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {items.map((item) => (
                            <li
                                key={item.id}
                                className="flex items-start justify-between gap-3 p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
                            >
                                <div className="flex-1 min-w-0">
                                    {item.status === "parsing" ? (
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {item.fileName}
                                        </div>
                                    ) : item.status === "parseError" ? (
                                        <div className="flex items-center gap-2 text-rose-600 font-medium">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate">{item.fileName}: {t("pdfParseErrorShort")}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <input
                                                type="text"
                                                value={item.name}
                                                disabled={item.status === "saving"}
                                                aria-label={t("nameLabel")}
                                                onChange={(e) => updateItem(item.id, { name: e.target.value })}
                                                className="font-bold text-slate-900 bg-transparent border-b border-slate-200 focus:border-primary outline-none w-full"
                                            />
                                            {item.topTalents && <TalentChips talents={item.topTalents} className="mt-1" />}
                                            {item.status === "saveError" && (
                                                <p className="mt-1 text-rose-600 font-medium">{t("itemSaveError")}</p>
                                            )}
                                        </>
                                    )}
                                </div>
                                {item.status === "saving" ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                                ) : (
                                    <button
                                        type="button"
                                        aria-label={t("removeFile")}
                                        disabled={saving}
                                        onClick={() => setItems((prev) => prev.filter((it) => it.id !== item.id))}
                                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors shrink-0"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                    <Button
                        type="button"
                        onClick={handleAddAll}
                        disabled={saving || isParsing || readyItems.length === 0}
                        className="w-full py-2.5 font-bold"
                    >
                        {saving ? t("addingAll") : t("addAll", { count: readyItems.length })}
                    </Button>
                </div>
            )}
        </div>
    );
}
