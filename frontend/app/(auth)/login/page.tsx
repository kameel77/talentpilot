"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, tokenManager } from "@/lib/api";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
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
        return "Login failed. Please try again.";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const { access_token } = await api.auth.login({ email, password });
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
                        <h1 className="text-headline mb-2">Witaj ponownie</h1>
                        <p className="text-body">
                            Zaloguj się, aby zarządzać talentami swojego zespołu
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                                {typeof error === "string" ? error : JSON.stringify(error)}
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

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 ml-1">
                                    Hasło
                                </label>
                                <Link
                                    href="/forgot-password"
                                    className="text-sm text-primary hover:underline font-medium"
                                >
                                    Zapomniałeś hasła?
                                </Link>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                <input
                                    id="password"
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

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-primary text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] inline-flex items-center justify-center gap-2"
                        >
                            {loading ? "Logowanie..." : "Zaloguj sie"}
                            <ArrowRight className="h-5 w-5" />
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-slate-500 font-medium">
                        Nie masz konta?{" "}
                        <Link href="/register" className="text-primary hover:text-blue-700 font-bold transition-colors">
                            Zarejestruj się
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
                            Odkryj potencjał{" "}
                            <span className="text-domain-strategic">talentów</span> w
                            Twoim zespole
                        </h2>
                        <p className="text-lg text-white/80 leading-relaxed mb-8">
                            TalentPilot pomaga menedżerom zrozumieć unikalne talenty Gallupa
                            każdego członka zespołu, budować silniejsze relacje i maksymalizować
                            efektywność wspołpracy.
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
                                <p className="text-sm text-white/60">Możliwosci</p>
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
