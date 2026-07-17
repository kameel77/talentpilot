"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Check, AlertTriangle } from "lucide-react";

import { api, AdminTalent, TalentTranslation } from "@/lib/api";
import { DOMAIN_LABELS, getDomainStyle, GallupDomain } from "@/lib/gallup-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const DOMAIN_ORDER = Object.keys(DOMAIN_LABELS) as GallupDomain[];

interface TranslationForm {
    name: string;
    short_description: string;
    description: string;
}

const EMPTY_FORM: TranslationForm = { name: "", short_description: "", description: "" };

function getTranslation(talent: AdminTalent, language: string): TalentTranslation | undefined {
    return talent.translations.find((tr) => tr.language === language);
}

export default function AdminTalentsPage() {
    const t = useTranslations("admin.talents");
    const [talents, setTalents] = useState<AdminTalent[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit dialog state
    const [editTalent, setEditTalent] = useState<AdminTalent | null>(null);
    const [formPl, setFormPl] = useState<TranslationForm>(EMPTY_FORM);
    const [formEn, setFormEn] = useState<TranslationForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [savedNotice, setSavedNotice] = useState(false);

    useEffect(() => {
        fetchTalents();
    }, []);

    const fetchTalents = async () => {
        try {
            setLoading(true);
            const data = await api.admin.listTalents();
            setTalents(data);
        } catch (error) {
            console.error("Failed to fetch talents:", error);
        } finally {
            setLoading(false);
        }
    };

    const openEdit = (talent: AdminTalent) => {
        const pl = getTranslation(talent, "pl");
        const en = getTranslation(talent, "en");
        setFormPl({ name: pl?.name ?? "", short_description: pl?.short_description ?? "", description: pl?.description ?? "" });
        setFormEn({ name: en?.name ?? "", short_description: en?.short_description ?? "", description: en?.description ?? "" });
        setSaveError(null);
        setEditTalent(talent);
    };

    const closeEdit = () => {
        setEditTalent(null);
        setSaveError(null);
    };

    const handleSave = async () => {
        if (!editTalent) return;

        setSaving(true);
        setSaveError(null);

        try {
            const languages: Array<{ lang: string; original?: TalentTranslation; form: TranslationForm }> = [
                { lang: "pl", original: getTranslation(editTalent, "pl"), form: formPl },
                { lang: "en", original: getTranslation(editTalent, "en"), form: formEn },
            ];

            const updated: Record<string, TalentTranslation> = {};

            for (const { lang, original, form } of languages) {
                const changed: { name?: string; short_description?: string; description?: string } = {};
                if (form.name !== (original?.name ?? "")) changed.name = form.name;
                if (form.short_description !== (original?.short_description ?? "")) changed.short_description = form.short_description;
                if (form.description !== (original?.description ?? "")) changed.description = form.description;

                if (Object.keys(changed).length === 0) continue;

                // The backend creates a missing translation row on first PATCH, but
                // requires `name` in that payload — always include it for a new row.
                if (!original && changed.name === undefined) {
                    changed.name = form.name;
                }

                updated[lang] = await api.admin.updateTalentTranslation(editTalent.id, lang, changed);
            }

            if (Object.keys(updated).length > 0) {
                setTalents((prev) => prev.map((talent) => {
                    if (talent.id !== editTalent.id) return talent;
                    const rest = talent.translations.filter((tr) => !(tr.language in updated));
                    return { ...talent, translations: [...rest, ...Object.values(updated)] };
                }));
            }

            setSavedNotice(true);
            setTimeout(() => setSavedNotice(false), 2000);
            closeEdit();
        } catch (error) {
            console.error("Failed to save talent translation:", error);
            setSaveError(t("saveError"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">{t("title")}...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">{t("title")}</h1>
                    <p className="mt-1 text-slate-500 font-medium">{t("subtitle")}</p>
                </div>
                {savedNotice && (
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                        <Check className="h-4 w-4" />
                        {t("saved")}
                    </div>
                )}
            </div>

            <div className="space-y-6">
                {DOMAIN_ORDER.map((domain) => {
                    const domainTalents = talents.filter((talent) => talent.domain === domain);
                    if (domainTalents.length === 0) return null;

                    return (
                        <div key={domain} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div
                                className="px-6 py-4 border-b border-slate-100 flex items-center gap-3"
                                style={{ background: getDomainStyle(domain, 10) }}
                            >
                                <span
                                    className="h-2.5 w-2.5 rounded-full shrink-0"
                                    style={{ background: getDomainStyle(domain) }}
                                />
                                <h2 className="text-base font-bold" style={{ color: getDomainStyle(domain) }}>
                                    {DOMAIN_LABELS[domain].pl}
                                </h2>
                            </div>

                            <div className="divide-y divide-slate-100">
                                {domainTalents.map((talent) => {
                                    const pl = getTranslation(talent, "pl");
                                    const en = getTranslation(talent, "en");
                                    return (
                                        <div key={talent.id} className="flex items-center justify-between gap-4 px-6 py-4">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-slate-900">{pl?.name || talent.code}</span>
                                                    <span className="text-sm text-slate-400">/ {en?.name || talent.code}</span>
                                                </div>
                                                {pl?.short_description ? (
                                                    <p className="mt-1 text-sm text-slate-500 truncate">{pl.short_description}</p>
                                                ) : (
                                                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        {t("missingShort")}
                                                    </span>
                                                )}
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => openEdit(talent)}>
                                                <Pencil className="h-4 w-4 mr-2" />
                                                {t("edit")}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <Dialog open={!!editTalent} onOpenChange={(open) => !open && closeEdit()}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editTalent ? (getTranslation(editTalent, "pl")?.name || editTalent.code) : ""}
                        </DialogTitle>
                        <DialogDescription>{t("subtitle")}</DialogDescription>
                    </DialogHeader>

                    {editTalent && (
                        <Tabs defaultValue="pl" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="pl">PL</TabsTrigger>
                                <TabsTrigger value="en">EN</TabsTrigger>
                            </TabsList>

                            <TabsContent value="pl" className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label htmlFor="talent-name-pl">{t("name")}</Label>
                                    <Input
                                        id="talent-name-pl"
                                        value={formPl.name}
                                        onChange={(e) => setFormPl({ ...formPl, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="talent-short-pl">{t("shortDescription")}</Label>
                                    <Textarea
                                        id="talent-short-pl"
                                        value={formPl.short_description}
                                        onChange={(e) => setFormPl({ ...formPl, short_description: e.target.value })}
                                        maxLength={500}
                                        className="min-h-[80px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="talent-desc-pl">{t("description")}</Label>
                                    <Textarea
                                        id="talent-desc-pl"
                                        value={formPl.description}
                                        onChange={(e) => setFormPl({ ...formPl, description: e.target.value })}
                                        className="min-h-[180px]"
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="en" className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label htmlFor="talent-name-en">{t("name")}</Label>
                                    <Input
                                        id="talent-name-en"
                                        value={formEn.name}
                                        onChange={(e) => setFormEn({ ...formEn, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="talent-short-en">{t("shortDescription")}</Label>
                                    <Textarea
                                        id="talent-short-en"
                                        value={formEn.short_description}
                                        onChange={(e) => setFormEn({ ...formEn, short_description: e.target.value })}
                                        maxLength={500}
                                        className="min-h-[80px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="talent-desc-en">{t("description")}</Label>
                                    <Textarea
                                        id="talent-desc-en"
                                        value={formEn.description}
                                        onChange={(e) => setFormEn({ ...formEn, description: e.target.value })}
                                        className="min-h-[180px]"
                                    />
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}

                    {saveError && (
                        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                            {saveError}
                        </div>
                    )}

                    <DialogFooter className="pt-2">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={saving}>{t("cancel")}</Button>
                        </DialogClose>
                        <Button type="button" onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {t("save")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
