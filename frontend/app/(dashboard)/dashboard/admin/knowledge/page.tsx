"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, X, Loader2, MessageSquare, Database, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, QueryReview } from "@/lib/api";

export default function AdminKnowledgePage() {
    const [queries, setQueries] = useState<QueryReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [editedTexts, setEditedTexts] = useState<Record<number, string>>({});

    // RAG settings state
    const [ragTopK, setRagTopK] = useState("8");
    const [ragTopKSaving, setRagTopKSaving] = useState(false);
    const [ragTopKSaved, setRagTopKSaved] = useState(false);

    useEffect(() => {
        fetchQueries();
        fetchRagSettings();
    }, []);

    const fetchQueries = async () => {
        try {
            setLoading(true);
            const data = await api.admin.listQueries();
            setQueries(data);

            // Initialize edited texts with original answers
            const initialTexts: Record<number, string> = {};
            data.forEach(q => {
                initialTexts[q.answer_id] = q.edited_text || q.answer_text;
            });
            setEditedTexts(initialTexts);
        } catch (error) {
            console.error("Failed to fetch queries:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchRagSettings = async () => {
        try {
            const data = await api.admin.getSettings();
            if (data.settings.rag_top_k) {
                setRagTopK(data.settings.rag_top_k);
            }
        } catch (error) {
            console.error("Failed to fetch RAG settings:", error);
        }
    };

    const saveRagTopK = async () => {
        const value = parseInt(ragTopK, 10);
        if (isNaN(value) || value < 1 || value > 50) return;
        try {
            setRagTopKSaving(true);
            await api.admin.updateSettings([{ key: "rag_top_k", value: String(value) }]);
            setRagTopKSaved(true);
            setTimeout(() => setRagTopKSaved(false), 2000);
        } catch (error) {
            console.error("Failed to save RAG TOP_K:", error);
        } finally {
            setRagTopKSaving(false);
        }
    };

    const handleReview = async (answerId: number, status: 'approved' | 'rejected') => {
        try {
            setProcessingId(answerId);
            const editedText = editedTexts[answerId];
            await api.admin.reviewAnswer(answerId, status, editedText);

            // Remove from list
            setQueries(prev => prev.filter(q => q.answer_id !== answerId));
        } catch (error) {
            console.error("Failed to review answer:", error);
        } finally {
            setProcessingId(null);
        }
    };

    const handleTextChange = (answerId: number, text: string) => {
        setEditedTexts(prev => ({ ...prev, [answerId]: text }));
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Pobieranie zapytań do recenzji...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">Baza wiedzy</h1>
                    <p className="mt-1 text-slate-500 font-medium">
                        Zarządzaj bazą wiedzy, przeglądaj pytania i konfiguruj parametry RAG.
                    </p>
                </div>
            </div>

            {/* Section cards: FAQ, Merytoryka, RAG Settings */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-slate-200/70 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                            <CardTitle className="text-base">FAQ</CardTitle>
                        </div>
                        <CardDescription>
                            Edytuj odpowiedzi na najczęstsze pytania użytkowników.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" size="sm">
                            <Link href="/dashboard/admin/knowledge/faq">Przejdź do FAQ</Link>
                        </Button>
                    </CardContent>
                </Card>
                <Card className="border-slate-200/70 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-emerald-600" />
                            <CardTitle className="text-base">Merytoryka</CardTitle>
                        </div>
                        <CardDescription>
                            Zarządzaj bazą wiedzy eksperckiej dla asystenta AI.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" size="sm">
                            <Link href="/dashboard/admin/knowledge/merytoryka">Przejdź do Merytoryki</Link>
                        </Button>
                    </CardContent>
                </Card>
                <Card className="border-slate-200/70 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <Settings2 className="h-4 w-4 text-violet-600" />
                            <CardTitle className="text-base">Ustawienia RAG</CardTitle>
                        </div>
                        <CardDescription>
                            Ile źródeł wiedzy pobierać do kontekstu AI.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-600 whitespace-nowrap">TOP_K:</label>
                            <Input
                                type="number"
                                min={1}
                                max={50}
                                value={ragTopK}
                                onChange={(e) => setRagTopK(e.target.value)}
                                className="w-20 bg-white"
                            />
                            <Button
                                size="sm"
                                onClick={saveRagTopK}
                                disabled={ragTopKSaving}
                                className="bg-violet-600 hover:bg-violet-700 text-white"
                            >
                                {ragTopKSaved ? (
                                    <Check className="h-4 w-4" />
                                ) : ragTopKSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    "Zapisz"
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Pending queries section */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">Nowe pytania</h2>
                    <Badge variant="outline" className="px-3 py-0.5 text-sm bg-blue-50 text-blue-700 border-blue-200">
                        {queries.length}
                    </Badge>
                </div>

                {queries.length === 0 ? (
                    <Card className="border-dashed border-2 bg-slate-50/50">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                            <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm border border-slate-100">
                                <Check className="h-8 w-8" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-slate-900">Wszystko gotowe!</h3>
                                <p className="text-slate-500 max-w-sm">
                                    Nie ma obecnie żadnych zapytań oczekujących na recenzję.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-6">
                        {queries.map((query) => (
                            <Card key={query.query_id} className="overflow-hidden border-slate-200/60 shadow-sm transition-all hover:shadow-md">
                                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 bg-blue-100 flex items-center justify-center rounded-lg text-blue-600">
                                                <MessageSquare className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                                                    Zapytanie użytkownika
                                                </span>
                                                <h4 className="text-sm font-bold text-slate-900 truncate max-w-md">
                                                    {query.question}
                                                </h4>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[10px] font-bold">
                                                {query.language.toUpperCase()}
                                            </Badge>
                                            <span className="text-[10px] font-medium text-slate-400">
                                                {new Date(query.created_at).toLocaleString('pl-PL', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase mb-1">
                                            <Database className="h-3 w-3" />
                                            Odpowiedź AI ({query.model_name})
                                        </div>
                                        <Textarea
                                            value={editedTexts[query.answer_id]}
                                            onChange={(e) => handleTextChange(query.answer_id, e.target.value)}
                                            className="min-h-[150px] bg-white border-slate-200 focus:ring-primary shadow-inner text-slate-700 leading-relaxed"
                                            placeholder="Treść odpowiedzi do bazy wiedzy..."
                                        />
                                        <p className="text-[10px] text-slate-400 italic">
                                            * Możesz wyedytować odpowiedź przed zatwierdzeniem jej jako stały element bazy wiedzy.
                                        </p>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleReview(query.answer_id, 'rejected')}
                                            disabled={processingId !== null}
                                            className="text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
                                        >
                                            <X className="h-4 w-4 mr-2" />
                                            Odrzuć
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => handleReview(query.answer_id, 'approved')}
                                            disabled={processingId !== null}
                                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 transition-all font-bold px-6"
                                        >
                                            {processingId === query.answer_id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <Check className="h-4 w-4 mr-2" />
                                                    Zatwierdź i Dodaj
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
