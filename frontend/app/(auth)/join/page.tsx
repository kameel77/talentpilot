"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, tokenManager } from "@/lib/api";
import { ArrowRight, Eye, EyeOff, Lock, PartyPopper } from "lucide-react";

function JoinForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const getErrorMessage = (err: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const error = err as any;
        const detail = error?.response?.data?.detail;
        if (typeof detail === "string") {
            return detail;
        }
        if (Array.isArray(detail)) {
            return detail.map((item) => item?.msg || "Invalid input").join(", ");
        }
        if (detail && typeof detail === "object") {
            return JSON.stringify(detail);
        }
        return "Activation failed. Please try again.";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Hasła nie są takie same.");
            return;
        }

        if (!token) {
            setError("Brak tokenu zaproszenia w linku.");
            return;
        }

        setLoading(true);

        try {
            const { access_token } = await api.invitations.acceptInvite(token, password);
            tokenManager.setToken(access_token);

            // Get user info and store
            const user = await api.auth.getCurrentUser();
            tokenManager.setUser(user);

            // Redirect to dashboard
            router.push("/dashboard");
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="flex min-h-screen w-full items-center justify-center px-6 py-12">
                <div className="mx-auto w-full max-w-md text-center">
                    <div className="mb-4 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-rose-50">
                        <Lock className="h-8 w-8 text-rose-500" />
                    </div>
                    <h1 className="text-headline mb-2">Nieprawidłowy link</h1>
                    <p className="text-body mb-6">
                        Link zaproszenia jest nieprawidłowy lub brakuje tokenu.
                        Skontaktuj się z osobą, która wysłała zaproszenie.
                    </p>
                    <Link
                        href="/login"
                        className="text-primary hover:text-blue-700 font-bold transition-colors"
                    >
                        Przejdź do logowania
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
                        <div className="flex items-center gap-3 mb-2">
                            <PartyPopper className="h-7 w-7 text-primary" />
                            <h1 className="text-headline">Aktywuj konto</h1>
                        </div>
                        <p className="text-body">
                            Zostałeś zaproszony do zespołu! Ustaw hasło, aby aktywować swoje konto.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                                {typeof error === "string" ? error : JSON.stringify(error)}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="password" className="block text-sm font-semibold text-slate-700 ml-1">
                                Hasło
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={8}
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
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight ml-1">
                                Min. 8 znaków
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-700 ml-1">
                                Potwierdź hasło
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                <input
                                    id="confirm-password"
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white focus:border-transparent transition-all outline-none text-slate-900"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-primary text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] inline-flex items-center justify-center gap-2"
                        >
                            {loading ? "Aktywuję konto..." : "Aktywuj konto"}
                            <ArrowRight className="h-5 w-5" />
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-slate-500 font-medium">
                        Masz już aktywne konto?{" "}
                        <Link href="/login" className="text-primary hover:text-blue-700 font-bold transition-colors">
                            Zaloguj się
                        </Link>
                    </div>
                </div>
            </div>

            <div className="hidden lg:flex lg:flex-1 bg-gradient-hero relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-domain-strategic/20 via-transparent to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-domain-relationship/20 via-transparent to-transparent" />

                <div className="relative z-10 flex flex-col justify-center p-12 text-white">
                    <div className="max-w-lg">
                        <h2 className="text-display mb-6">
                            Witamy w{" "}
                            <span className="text-domain-strategic">TalentPilot</span>
                        </h2>
                        <p className="text-lg text-white/80 leading-relaxed mb-8">
                            Twój zespół zaprasza Cię do platformy, która pomoże Ci
                            zrozumieć swoje talenty Gallupa i wykorzystać je do
                            budowania silniejszych relacji w pracy.
                        </p>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <p className="text-3xl font-bold font-heading">34</p>
                                <p className="text-sm text-white/60">Talenty Gallupa</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-3xl font-bold font-heading">4</p>
                                <p className="text-sm text-white/60">Domeny</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-3xl font-bold font-heading">INF</p>
                                <p className="text-sm text-white/60">Możliwości</p>
                            </div>
                        </div>
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

export default function JoinPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-screen items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
            }
        >
            <JoinForm />
        </Suspense>
    );
}
