"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function PwaManager() {
    const [installPrompt, setInstallPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if ("serviceWorker" in navigator) {
            window.addEventListener("load", () => {
                navigator.serviceWorker.register("/sw.js").catch(() => {
                    // Fail silently to avoid blocking the UI.
                });
            });
        }

        const handler = (event: Event) => {
            event.preventDefault();
            setInstallPrompt(event as BeforeInstallPromptEvent);
        };

        window.addEventListener("beforeinstallprompt", handler);
        return () => {
            window.removeEventListener("beforeinstallprompt", handler);
        };
    }, []);

    const handleInstall = async () => {
        if (!installPrompt) {
            return;
        }
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === "accepted") {
            setInstallPrompt(null);
        }
    };

    if (!installPrompt || dismissed) {
        return null;
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold text-slate-900">
                Install TalentPilot
            </p>
            <p className="mt-1 text-xs text-slate-500">
                Get offline access and quick launch from your home screen.
            </p>
            <div className="mt-4 flex gap-2">
                <button
                    onClick={() => setDismissed(true)}
                    className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-300"
                >
                    Later
                </button>
                <button
                    onClick={handleInstall}
                    className="flex-1 rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-indigo-700"
                >
                    Install
                </button>
            </div>
        </div>
    );
}
