"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { ArrowRight, Eye, EyeOff, Lock, CheckCircle2, ShieldAlert } from "lucide-react";

export default function ResetPasswordPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setMessage("Brakujący link do resetowania hasła z Twojego adresu e-mail.");
        }
    }, [token]);

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
        return "Resetowanie hasła nie powiodło się, link mógł stracić ważność.";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!token) {
            setStatus("error");
            setMessage("Brak prawidłowego tokenu.");
            return;
        }

        if (password !== confirmPassword) {
            setStatus("error");
            setMessage("Wprowadzone hasła muszą być identyczne.");
            return;
        }

        if (password.length < 8) {
            setStatus("error");
            setMessage("Hasło musi mieć co najmniej 8 znaków.");
            return;
        }

        setStatus("loading");
        setMessage("");

        try {
            const res = await api.auth.resetPassword(token, password);
            setStatus("success");
            setMessage(res.message || "Hasło zostało pomyślnie zmienione.");
            
            // Redirect after couple of seconds
            setTimeout(() => {
                router.push("/login");
            }, 3000);
        } catch (err) {
            setStatus("error");
            setMessage(getErrorMessage(err));
        }
    };

    if (!token && status === "error") {
        return (
            <div className="flex min-h-screen w-full items-center justify-center p-6 bg-slate-50">
                <div className="max-w-md text-center p-8 bg-white border border-slate-200 rounded-3xl shadow-sm">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                        <ShieldAlert className="h-8 w-8" />
                    </div>
                    <h1 className="text-2xl font-bold mb-4 text-slate-800">Nieprawidłowy link</h1>
                    <p className="text-slate-600 mb-8">{message}</p>
                    <Link
                        href="/login"
                        className="inline-flex items-center justify-center w-full min-w-40 rounded-xl bg-gradient-primary px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
                    >
                        Wróć do logowania
                    </Link>
                </div>
            </div>
        );
    }

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
                        <h1 className="text-headline mb-2">Ustaw nowe hasło</h1>
                        <p className="text-body">
                            Wpisz mocne, nowe hasło poniżej. Wymagane są minimum 8 znaków.
                        </p>
                    </div>

                    {status === "success" ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center text-emerald-800">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                <CheckCircle2 className="h-8 w-8" />
                            </div>
                            <h3 className="mb-2 text-xl font-bold text-emerald-900">Hasło Zmienione</h3>
                            <p className="mb-6">{message}</p>
                            <Link
                                href="/login"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-6 py-3.5 font-bold text-white transition-opacity hover:opacity-90 shadow-lg shadow-blue-500/10"
                            >
                                Zaloguj się teraz
                                <ArrowRight className="h-5 w-5" />
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
                                <label htmlFor="new-password" className="block text-sm font-semibold text-slate-700 ml-1">
                                    Nowe hasło
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                    <input
                                        id="new-password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full h-12 pl-11 pr-11 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white focus:border-transparent transition-all outline-none text-slate-900"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-700 ml-1">
                                    Powtórz hasło
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                    <input
                                        id="confirm-password"
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className="w-full h-12 pl-11 pr-11 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white focus:border-transparent transition-all outline-none text-slate-900"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                                    >
                                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={status === "loading"}
                                className="w-full bg-gradient-primary text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] inline-flex items-center justify-center gap-2"
                            >
                                {status === "loading" ? "Proszę czekać..." : "Zapisz hasło i Zaloguj się"}
                                {!status && <ArrowRight className="h-5 w-5" />}
                            </button>
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
                            Bezpieczeństwo{" "}
                            <span className="text-domain-executing">potwierdzone</span>
                        </h2>
                        <p className="text-lg text-white/80 leading-relaxed mb-8">
                            Dla ochrony wrażliwych danych na temat mocnych stron całego Twojego zespołu, przechowujemy tylko zhashowane wersje haseł, nie udostępniając ich nikomu innemu.
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
