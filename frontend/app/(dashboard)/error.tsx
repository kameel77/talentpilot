"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Dashboard view error:", error);
    }, [error]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-5">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl mx-auto flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-lg font-bold text-slate-900">Wystąpił problem z tym widokiem</h2>
                    <p className="text-xs text-slate-600">
                        Nie udało się załadować zawartości. Dane Twojego konta są bezpieczne.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <Button onClick={() => reset()} variant="outline" className="w-full sm:w-auto gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Odśwież
                    </Button>
                    <Button asChild className="w-full sm:w-auto gap-2">
                        <Link href="/dashboard">
                            <LayoutDashboard className="w-4 h-4" />
                            Pulpit
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
