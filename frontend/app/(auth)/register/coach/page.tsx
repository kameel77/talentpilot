"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { api, tokenManager } from "@/lib/api";

export default function RegisterCoachPage() {
    const t = useTranslations("auth.registerCoach");
    const router = useRouter();
    const [formData, setFormData] = useState({ full_name: "", email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

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
        return "Registration failed. Please try again.";
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const { access_token } = await api.auth.registerCoach(formData);
            tokenManager.setToken(access_token);

            // Get user info and store
            const user = await api.auth.getCurrentUser();
            tokenManager.setUser(user);

            // One-time cookie routes the coach into the onboarding wizard
            document.cookie = "onboarding=1; path=/; max-age=3600; SameSite=Lax";
            router.push("/dashboard/onboarding");
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold font-heading text-primary tracking-tight">
                        TalentPilot
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">{t("subtitle")}</p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl shadow-blue-500/5 border border-slate-200 p-10 animate-fade-up">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">{t("title")}</h2>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                                {typeof error === "string" ? error : JSON.stringify(error)}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label htmlFor="full_name" className="block text-sm font-semibold text-slate-700 ml-1">
                                {t("fullName")}
                            </label>
                            <input
                                id="full_name"
                                name="full_name"
                                type="text"
                                value={formData.full_name}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white focus:border-transparent transition-all outline-none text-slate-900"
                                placeholder="John Doe"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="email" className="block text-sm font-semibold text-slate-700 ml-1">
                                {t("email")}
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white focus:border-transparent transition-all outline-none text-slate-900"
                                placeholder="name@company.com"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="password" className="block text-sm font-semibold text-slate-700 ml-1">
                                {t("password")}
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                minLength={8}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white focus:border-transparent transition-all outline-none text-slate-900"
                                placeholder="••••••••"
                            />
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight ml-1">Min. 8 characters</p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white py-3.5 mt-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                            {loading ? t("submitting") : t("submit")}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm text-slate-500 font-medium">
                        {t("haveAccount")}{" "}
                        <Link href="/login" className="text-primary hover:text-blue-700 font-bold transition-colors">
                            {t("login")}
                        </Link>
                    </div>
                    <p className="mt-3 text-center text-xs text-slate-400">{t("memberHint")}</p>
                </div>
            </div>
        </div>
    );
}
