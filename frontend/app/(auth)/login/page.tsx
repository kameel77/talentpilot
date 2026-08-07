"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { api, tokenManager } from "@/lib/api";
import { setLocale } from "@/lib/locale";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const t = useTranslations("auth.login");
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
            return detail.map((item) => item?.msg || t("invalidInput")).join(", ");
        }
        if (detail && typeof detail === "object") {
            return JSON.stringify(detail);
        }
        return t("loginFailed");
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

            if (user.language) {
                setLocale(user.language as "pl" | "en");
            }

            // Redirect to dashboard
            router.push("/dashboard");
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
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
                <h1 className="text-headline mb-2">{t("title")}</h1>
                <p className="text-body">
                    {t("subtitle")}
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
                        {t("emailLabel")}
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
                            {t("passwordLabel")}
                        </label>
                        <Link
                            href="/forgot-password"
                            className="text-sm text-primary hover:underline font-medium"
                        >
                            {t("forgotPassword")}
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
                            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
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
                    {loading ? t("loading") : t("submit")}
                    <ArrowRight className="h-5 w-5" />
                </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-500 font-medium">
                {t("alreadyHaveAccount")}{" "}
                <Link href="/register" className="text-primary hover:text-blue-700 font-bold transition-colors">
                    {t("signUp")}
                </Link>
            </div>
        </div>
    );
}
