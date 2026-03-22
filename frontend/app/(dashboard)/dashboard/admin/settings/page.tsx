"use client";

import { useEffect, useState } from "react";
import { api, AdminSettingUpdate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, Sparkles, Shield, Cpu, Zap } from "lucide-react";

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const data = await api.admin.getSettings();
            setSettings(data.settings);
        } catch (error) {
            console.error("Failed to fetch settings:", error);
            // alert("Błąd podczas pobierania ustawień");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const updates: AdminSettingUpdate[] = Object.entries(settings).map(([key, value]) => ({
                key,
                value: String(value),
            }));
            await api.admin.updateSettings(updates);
            // alert("Ustawienia zostały zapisane");
        } catch (error) {
            console.error("Failed to save settings:", error);
            // alert("Wystąpił błąd podczas zapisywania ustawień");
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Pobieranie ustawień AI...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">Ustawienia AI</h1>
                <p className="mt-1 text-slate-500 font-medium">
                    Skonfiguruj parametry działania asystenta AI oraz bazy wiedzy.
                </p>
            </div>

            <div className="grid gap-6">
                {/* AI Assistant Configuration */}
                <Card className="border-slate-200/60 shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                <Sparkles className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Konfiguracja Asystenta</CardTitle>
                                <CardDescription>Główne parametry modelu językowego</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="chat-model" className="flex items-center gap-2">
                                    <Cpu className="h-3 w-3 text-slate-400" />
                                    Model Czat
                                </Label>
                                <Input
                                    id="chat-model"
                                    value={settings.openrouter_chat_model || ""}
                                    onChange={(e) => handleChange("openrouter_chat_model", e.target.value)}
                                    placeholder="openai/gpt-4o-mini"
                                    className="bg-white"
                                />
                                <p className="text-[10px] text-slate-400">Generowanie odpowiedzi, tipsów, synergii</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="embedding-model" className="flex items-center gap-2">
                                    <Cpu className="h-3 w-3 text-slate-400" />
                                    Model Embedding
                                </Label>
                                <Input
                                    id="embedding-model"
                                    value={settings.openrouter_embedding_model || ""}
                                    onChange={(e) => handleChange("openrouter_embedding_model", e.target.value)}
                                    placeholder="text-embedding-3-small"
                                    className="bg-white"
                                />
                                <p className="text-[10px] text-slate-400">Wektoryzacja pytań i wyszukiwanie w bazie wiedzy (RAG)</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="query-limit" className="flex items-center gap-2">
                                    <Zap className="h-3 w-3 text-slate-400" />
                                    Dzienny limit zapytań
                                </Label>
                                <Input
                                    id="query-limit"
                                    type="number"
                                    value={settings.daily_query_limit || ""}
                                    onChange={(e) => handleChange("daily_query_limit", e.target.value)}
                                    className="bg-white"
                                />
                                <p className="text-[10px] text-slate-400">Maks. pytań na użytkownika / 24h (0 = bez limitu)</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600">
                                    <Zap className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">Streaming (SSE)</p>
                                    <p className="text-[10px] text-slate-400">Odpowiedzi pojawiają się słowo po słowie zamiast czekać na pełen tekst</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleChange("streaming_enabled", settings.streaming_enabled === "true" ? "false" : "true")}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    settings.streaming_enabled === "true" ? "bg-emerald-600" : "bg-slate-300"
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                        settings.streaming_enabled === "true" ? "translate-x-6" : "translate-x-1"
                                    }`}
                                />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="system-prompt" className="flex items-center gap-2">
                                <Shield className="h-3 w-3 text-slate-400" />
                                System Prompt (Instrukcje dla AI)
                            </Label>
                            <Textarea
                                id="system-prompt"
                                value={settings.system_prompt || ""}
                                onChange={(e) => handleChange("system_prompt", e.target.value)}
                                className="min-h-[250px] bg-white text-slate-700 leading-relaxed font-mono text-sm"
                                placeholder="Jesteś pomocnym asystentem..."
                            />
                            <p className="text-[10px] text-slate-400 italic">
                                * System prompt definiuje ton, styl i sposób działania asystenta we wszystkich rozmowach.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Intent Classifier Configuration */}
                <Card className="border-slate-200/60 shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                                <Zap className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Klasyfikator intencji</CardTitle>
                                <CardDescription>Automatyczne rozpoznawanie typu pytania i dobór formatu odpowiedzi</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="intent-model" className="flex items-center gap-2">
                                <Cpu className="h-3 w-3 text-slate-400" />
                                Model klasyfikatora
                            </Label>
                            <Input
                                id="intent-model"
                                value={settings.intent_classifier_model || ""}
                                onChange={(e) => handleChange("intent_classifier_model", e.target.value)}
                                placeholder="openai/gpt-4.1-nano"
                                className="bg-white"
                            />
                            <p className="text-[10px] text-slate-400">Szybki, tani model do klasyfikacji intencji pytań (np. gpt-4.1-nano, gemini-2.0-flash)</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="intent-prompt" className="flex items-center gap-2">
                                <Shield className="h-3 w-3 text-slate-400" />
                                Prompt klasyfikatora
                            </Label>
                            <Textarea
                                id="intent-prompt"
                                value={settings.intent_classifier_prompt || ""}
                                onChange={(e) => handleChange("intent_classifier_prompt", e.target.value)}
                                className="min-h-[180px] bg-white text-slate-700 leading-relaxed font-mono text-sm"
                                placeholder="Zaklasyfikuj intencję pytania..."
                            />
                            <p className="text-[10px] text-slate-400 italic">
                                * Placeholdery: <code className="bg-slate-100 px-1 rounded">{"{question}"}</code> — pytanie użytkownika, <code className="bg-slate-100 px-1 rounded">{"{intent_classes}"}</code> — lista dostępnych klas z bazy wiedzy (sekcja Instrukcje).
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-end">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-soft-xl transition-all font-bold px-12 py-6 rounded-2xl text-lg group"
                >
                    {saving ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-3" />
                    ) : (
                        <Save className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
                    )}
                    Zapisz ustawienia AI
                </Button>
            </div>
        </div>
    );
}
