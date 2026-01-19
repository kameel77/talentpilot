"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DomainBadge } from '@/components/ui/DomainBadge';
import { GALLUP_TALENTS } from '@/data/gallupTalents';
import { UserTalent } from '@/types/talent';
import { api } from '@/lib/api';
import {
    Upload,
    FileText,
    CheckCircle2,
    AlertCircle,
    Loader2,
    X,
    Edit3,
    RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PdfTalentImportProps {
    userId?: number;
    onUsersChange?: () => void;
    onImportComplete: (talents: UserTalent[]) => void;
    onSwitchToManual: (talents: UserTalent[]) => void;
}

type ImportStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

interface ParsedRankings {
    rankings: Record<string, number>;
    translated_rankings: Record<string, number>;
    page_index: number | null;
    language: string;
}

export function PdfTalentImport({ userId, onUsersChange, onImportComplete, onSwitchToManual }: PdfTalentImportProps) {
    const [status, setStatus] = useState<ImportStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [fileName, setFileName] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<ParsedRankings | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(userId || null);
    const [users, setUsers] = useState<{ id: number; full_name: string }[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [language, setLanguage] = useState('pl');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadUsers = async () => {
        try {
            const usersList = await api.users.list();
            setUsers(usersList);
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    };

    useEffect(() => {
        console.log('[PdfTalentImport] useEffect triggered - userId prop:', userId);
        const timer = setTimeout(() => {
            if (userId) {
                console.log('[PdfTalentImport] Setting selectedUserId to:', userId);
                setSelectedUserId(userId);
            } else {
                console.log('[PdfTalentImport] userId is falsy, loading users list');
                loadUsers();
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [userId]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            setErrorMessage('Proszę wybrać plik PDF');
            setStatus('error');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setErrorMessage('Plik jest zbyt duży. Maksymalny rozmiar to 10MB');
            setStatus('error');
            return;
        }

        if (!selectedUserId && !userId) {
            setErrorMessage('Proszę wybrać użytkownika');
            setStatus('error');
            return;
        }

        setFileName(file.name);
        setStatus('uploading');
        setProgress(0);
        setErrorMessage(null);

        const uploadInterval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(uploadInterval);
                    return 100;
                }
                return prev + 20;
            });
        }, 200);

        await new Promise(resolve => setTimeout(resolve, 1200));
        clearInterval(uploadInterval);
        setProgress(100);

        setStatus('processing');
        setProgress(0);

        const processInterval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 90) {
                    clearInterval(processInterval);
                    return 90;
                }
                return prev + 15;
            });
        }, 300);

        try {
            const data = await api.gallup.parsePdf(file, language);
            clearInterval(processInterval);
            setProgress(100);
            setParsedData(data);
            setStatus('success');
        } catch (error) {
            clearInterval(processInterval);
            setErrorMessage('Nie udało się przetworzyć pliku. Spróbuj ponownie lub wprowadź dane ręcznie.');
            setStatus('error');
        }
    };

    const handleReset = () => {
        setStatus('idle');
        setProgress(0);
        setFileName(null);
        setParsedData(null);
        setErrorMessage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleConfirm = async () => {
        console.log('[PdfTalentImport] handleConfirm called', { parsedData: !!parsedData, selectedUserId, userId });

        if (!parsedData) {
            console.error('[PdfTalentImport] No parsed data available');
            setErrorMessage('Brak danych do zapisania. Spróbuj ponownie zaimportować plik.');
            setStatus('error');
            return;
        }

        const targetUserId = selectedUserId || userId;
        if (!targetUserId) {
            console.error('[PdfTalentImport] No user ID available', { selectedUserId, userId });
            setErrorMessage('Błąd: Nie można zidentyfikować użytkownika. Odśwież stronę i spróbuj ponownie.');
            setStatus('error');
            return;
        }

        console.log('[PdfTalentImport] Saving talents for user', targetUserId, 'rankings:', parsedData.rankings);

        try {
            await api.gallup.saveTalents(targetUserId, parsedData.rankings, language);
            console.log('[PdfTalentImport] Talents saved successfully');
            if (onUsersChange) {
                onUsersChange();
            }
            const talents: UserTalent[] = Object.entries(parsedData.rankings).map(([code, rank]) => ({
                talentId: code,
                rank,
            }));
            onImportComplete(talents);
        } catch (error) {
            console.error('[PdfTalentImport] Error saving talents:', error);
            setErrorMessage('Nie udało się zapisać talentów. Spróbuj ponownie.');
            setStatus('error');
        }
    };

    const handleEditManually = () => {
        if (parsedData) {
            const talents: UserTalent[] = Object.entries(parsedData.rankings).map(([code, rank]) => ({
                talentId: code,
                rank,
            }));
            onSwitchToManual(talents);
        } else {
            onSwitchToManual([]);
        }
    };

    const getTalentDisplayName = (talentId: string) => {
        const talent = GALLUP_TALENTS.find(t => t.id === talentId);
        if (!talent) return talentId;
        return language === 'pl' ? talent.namePl : talent.name;
    };

    return (
        <div className="space-y-6">
            {status === 'idle' && (
                <div className="space-y-4">
                    {!userId && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Użytkownik</label>
                                <select
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={selectedUserId?.toString() || ''}
                                    onChange={(e) => setSelectedUserId(e.target.value ? parseInt(e.target.value) : null)}
                                >
                                    <option value="">Wybierz użytkownika</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id.toString()}>
                                            {user.full_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Język raportu</label>
                                <select
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                >
                                    <option value="pl">Polski</option>
                                    <option value="en">English</option>
                                </select>
                            </div>
                        </div>
                    )}

                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                            "relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all",
                            "hover:border-primary/50 hover:bg-primary/5",
                            "border-muted-foreground/25"
                        )}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <Upload className="h-8 w-8 text-primary" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-lg font-semibold">Przeciągnij plik PDF lub kliknij</p>
                                <p className="text-sm text-muted-foreground">
                                    Obsługujemy oficjalne raporty CliftonStrengths (Gallup)
                                </p>
                            </div>
                            <Button variant="outline">
                                <FileText className="h-4 w-4 mr-2" />
                                Wybierz plik PDF
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                        <p className="text-sm font-medium">Wskazówki:</p>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                            <li>Zaloguj się na gallup.com i pobierz swój raport w PDF</li>
                            <li>Upewnij się, że plik zawiera pełną listę 34 talentów</li>
                            <li>Obsługujemy raporty w języku polskim i angielskim</li>
                        </ul>
                    </div>
                </div>
            )}

            {status === 'uploading' && (
                <div className="rounded-2xl border bg-card p-8 text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    </div>
                    <div className="space-y-2">
                        <p className="font-semibold">Przesyłanie pliku...</p>
                        <p className="text-sm text-muted-foreground">{fileName}</p>
                    </div>
                    <Progress value={progress} className="w-full max-w-xs mx-auto" />
                </div>
            )}

            {status === 'processing' && (
                <div className="rounded-2xl border bg-card p-8 text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                    </div>
                    <div className="space-y-2">
                        <p className="font-semibold">Analizowanie raportu...</p>
                        <p className="text-sm text-muted-foreground">
                            Rozpoznajemy talenty z Twojego raportu Gallup
                        </p>
                    </div>
                    <Progress value={progress} className="w-full max-w-xs mx-auto" />
                </div>
            )}

            {status === 'success' && parsedData && (
                <div className="space-y-6">
                    <div className="rounded-2xl border bg-card p-6 space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="h-6 w-6 text-green-500" />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-green-600">Import zakończony pomyślnie!</p>
                                <p className="text-sm text-muted-foreground">
                                    Rozpoznano {Object.keys(parsedData.rankings).length} talentów z pliku {fileName}
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleReset}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                            {Object.entries(parsedData.rankings)
                                .sort(([, a], [, b]) => a - b)
                                .slice(0, 10)
                                .map(([talentId, rank]) => {
                                    const isTop5 = rank <= 5;
                                    return (
                                        <div
                                            key={talentId}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-lg",
                                                isTop5 ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/50"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold",
                                                isTop5 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                            )}>
                                                {rank}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{getTalentDisplayName(talentId)}</p>
                                            </div>
                                            <DomainBadge domain={GALLUP_TALENTS.find(t => t.id === talentId)?.domain || 'executing'} size="sm" />
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 justify-end">
                        <Button variant="outline" onClick={handleEditManually}>
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edytuj ręcznie
                        </Button>
                        <Button variant="hero" onClick={handleConfirm}>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Zatwierdź i zapisz
                        </Button>
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="rounded-2xl border border-destructive/50 bg-destructive/5 p-6 space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                            <AlertCircle className="h-6 w-6 text-destructive" />
                        </div>
                        <div className="flex-1 space-y-2">
                            <p className="font-semibold text-destructive">Błąd importu</p>
                            <p className="text-sm text-muted-foreground">{errorMessage}</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={handleReset}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Spróbuj ponownie
                        </Button>
                        <Button variant="outline" onClick={() => onSwitchToManual([])}>
                            <Edit3 className="h-4 w-4 mr-2" />
                            Wprowadź ręcznie
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
