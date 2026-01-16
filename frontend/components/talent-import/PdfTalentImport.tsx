"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DomainBadge } from '@/components/ui/DomainBadge';
import { GALLUP_TALENTS } from '@/data/gallupTalents';
import { UserTalent } from '@/types/talent';
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
    onImportComplete: (talents: UserTalent[]) => void;
    onSwitchToManual: (talents: UserTalent[]) => void;
}

type ImportStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

// Simulated PDF parsing - in real implementation this would use OCR/AI
function simulatePdfParsing(): Promise<UserTalent[]> {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Simulate extracting top 10 talents from a Gallup report PDF
            const sampleTalents: UserTalent[] = [
                { talentId: 'strategic', rank: 1 },
                { talentId: 'learner', rank: 2 },
                { talentId: 'achiever', rank: 3 },
                { talentId: 'analytical', rank: 4 },
                { talentId: 'ideation', rank: 5 },
                { talentId: 'input', rank: 6 },
                { talentId: 'intellection', rank: 7 },
                { talentId: 'focus', rank: 8 },
                { talentId: 'responsibility', rank: 9 },
                { talentId: 'futuristic', rank: 10 },
            ];
            resolve(sampleTalents);
        }, 2500);
    });
}

export function PdfTalentImport({ onImportComplete, onSwitchToManual }: PdfTalentImportProps) {
    const [status, setStatus] = useState<ImportStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [fileName, setFileName] = useState<string | null>(null);
    const [parsedTalents, setParsedTalents] = useState<UserTalent[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            setErrorMessage('Proszę wybrać plik PDF');
            setStatus('error');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setErrorMessage('Plik jest zbyt duży. Maksymalny rozmiar to 10MB');
            setStatus('error');
            return;
        }

        setFileName(file.name);
        setStatus('uploading');
        setProgress(0);
        setErrorMessage(null);

        // Simulate upload progress
        const uploadInterval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(uploadInterval);
                    return 100;
                }
                return prev + 20;
            });
        }, 200);

        // Wait for "upload" to complete
        await new Promise(resolve => setTimeout(resolve, 1200));
        clearInterval(uploadInterval);
        setProgress(100);

        // Start processing
        setStatus('processing');
        setProgress(0);

        // Simulate processing progress
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
            const talents = await simulatePdfParsing();
            clearInterval(processInterval);
            setProgress(100);
            setParsedTalents(talents);
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
        setParsedTalents([]);
        setErrorMessage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleConfirm = () => {
        onImportComplete(parsedTalents);
    };

    const handleEditManually = () => {
        onSwitchToManual(parsedTalents);
    };

    return (
        <div className="space-y-6">
            {/* Upload zone */}
            {status === 'idle' && (
                <div className="space-y-4">
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
                        <p className="text-sm font-medium">💡 Wskazówki:</p>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                            <li>Zaloguj się na gallup.com i pobierz swój raport w PDF</li>
                            <li>Upewnij się, że plik zawiera pełną listę 34 talentów</li>
                            <li>Obsługujemy raporty w języku polskim i angielskim</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* Uploading state */}
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

            {/* Processing state */}
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

            {/* Success state */}
            {status === 'success' && (
                <div className="space-y-6">
                    <div className="rounded-2xl border bg-card p-6 space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="h-6 w-6 text-green-500" />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-green-600">Import zakończony pomyślnie!</p>
                                <p className="text-sm text-muted-foreground">
                                    Rozpoznano {parsedTalents.length} talentów z pliku {fileName}
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleReset}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Preview of parsed talents */}
                        <div className="grid gap-2 sm:grid-cols-2">
                            {parsedTalents.slice(0, 10).map((userTalent) => {
                                const talent = GALLUP_TALENTS.find(t => t.id === userTalent.talentId);
                                if (!talent) return null;

                                const isTop5 = userTalent.rank <= 5;

                                return (
                                    <div
                                        key={talent.id}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-lg",
                                            isTop5 ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/50"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold",
                                            isTop5 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                        )}>
                                            {userTalent.rank}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{talent.namePl}</p>
                                        </div>
                                        <DomainBadge domain={talent.domain} size="sm" />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Action buttons */}
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

            {/* Error state */}
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
