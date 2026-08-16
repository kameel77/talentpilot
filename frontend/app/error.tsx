"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Global application error:", error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-8 text-center space-y-6">
                <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl mx-auto flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-slate-900">Coś poszło nie tak</h2>
                    <p className="text-sm text-slate-600">
                        Wystąpił nieoczekiwany błąd podczas ładowania widoku. Możesz spróbować odświeżyć stronę lub wrócić do pulpitu.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <Button onClick={() => reset()} variant="outline" className="w-full sm:w-auto gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Spróbuj ponownie
                    </Button>
                    <Button asChild className="w-full sm:w-auto gap-2">
                        <Link href="/dashboard">
                            <Home className="w-4 h-4" />
                            Pulpit
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
