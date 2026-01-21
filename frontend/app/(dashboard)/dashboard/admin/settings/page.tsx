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
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="chat-model" className="flex items-center gap-2">
                                    <Cpu className="h-3 w-3 text-slate-400" />
                                    Model Czat (OpenRouter ID)
                                </Label>
                                <Input
                                    id="chat-model"
                                    value={settings.openrouter_chat_model || ""}
                                    onChange={(e) => handleChange("openrouter_chat_model", e.target.value)}
                                    placeholder="openai/gpt-4o-mini"
                                    className="bg-white"
                                />
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
                            </div>
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
