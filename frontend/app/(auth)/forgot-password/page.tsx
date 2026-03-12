"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { ArrowLeft, Mail, RefreshCw } from "lucide-react";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const getErrorMessage = (err: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const error = err as any;
        const detail = error?.response?.data?.detail;
        if (typeof detail === "string") {
            return detail;
        }
        if (Array.isArray(detail)) {
            return detail.map((item) => item?.msg || "Błędne dane").join(", ");
        }
        return "Wystąpił nieoczekiwany błąd. Spróbuj powtórnie.";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("loading");
        setMessage("");

        try {
            const res = await api.auth.forgotPassword(email);
            setStatus("success");
            setMessage(res.message || "Wysłano link resetujący, sprawdź skrzynkę.");
        } catch (err) {
            setStatus("error");
            setMessage(getErrorMessage(err));
        }
    };

    return (
        <div className="flex min-h-screen w-full">
            <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-12">
                <div className="mx-auto w-full max-w-md">
                    <div className="mb-8">
                        <Link href="/" className="inline-flex items-center gap-2">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-white font-bold text-lg">
                                TP
                            </div>
                            <span className="font-heading font-bold text-xl">TalentPilot</span>
                        </Link>
                    </div>

                    <div className="mb-8">
                        <h1 className="text-headline mb-2">Zapomniałeś hasła?</h1>
                        <p className="text-body">
                            Podaj swój adres e-mail, a prześlemy Ci link do ustawienia nowego hasła.
                        </p>
                    </div>

                    {status === "success" ? (
                        <div className="space-y-6">
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-emerald-800">
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                    <Mail className="h-6 w-6" />
                                </div>
                                <h3 className="mb-2 font-bold text-emerald-900">Sprawdź swoją skrzynkę</h3>
                                <p className="text-sm">{message}</p>
                            </div>
                            <Link 
                                href="/login" 
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Wróć do logowania
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {status === "error" && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                                    {message}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 ml-1">
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white focus:border-transparent transition-all outline-none text-slate-900"
                                        placeholder="jan.kowalski@firma.pl"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={status === "loading"}
                                className="w-full bg-gradient-primary text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] inline-flex items-center justify-center gap-2"
                            >
                                {status === "loading" ? (
                                    <>
                                        <RefreshCw className="h-5 w-5 animate-spin" />
                                        Wysyłanie...
                                    </>
                                ) : (
                                    "Wyślij link"
                                )}
                            </button>

                            <div className="text-center mt-6">
                                <Link 
                                    href="/login" 
                                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Wróć do logowania
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            <div className="hidden lg:flex lg:flex-1 bg-gradient-hero relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-domain-strategic/20 via-transparent to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-domain-relationship/20 via-transparent to-transparent" />

                <div className="relative z-10 flex flex-col justify-center p-12 text-white">
                    <div className="max-w-lg">
                        <h2 className="text-display mb-6">
                            Nigdy nie trać{" "}
                            <span className="text-domain-relationship">dostępu</span> do 
                            swoich danych
                        </h2>
                        <p className="text-lg text-white/80 leading-relaxed mb-8">
                            Dzięki szybkiemu odzyskiwaniu hasła znowu będziesz mógł analizować oraz wzmacniać kompetencje swojego zespołu w krótkim czasie.
                        </p>
                    </div>

                    <div className="absolute top-20 right-20 h-64 w-64 rounded-full border border-white/10" />
                    <div className="absolute bottom-32 right-32 h-40 w-40 rounded-full border border-white/10" />
                    <div className="absolute bottom-20 right-60 h-20 w-20 rounded-full bg-domain-influencing/30 blur-xl" />
                    <div className="absolute top-40 right-40 h-32 w-32 rounded-full bg-domain-executing/20 blur-2xl" />
                </div>
            </div>
        </div>
    );
}
