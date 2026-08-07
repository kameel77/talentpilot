"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { ArrowRight, Eye, EyeOff, Lock, CheckCircle2, ShieldAlert } from "lucide-react";

export default function ResetPasswordPage() {
    const t = useTranslations("common");

    return (
        <Suspense fallback={
            <div className="flex w-full items-center justify-center py-24">
                <div className="animate-pulse text-slate-400 font-medium">{t("loading")}</div>
            </div>
        }>
            <ResetPasswordContent />
        </Suspense>
    );
}

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const t = useTranslations("auth.resetPassword");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(token ? "idle" : "error");
    const [message, setMessage] = useState(token ? "" : t("missingToken"));
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const getErrorMessage = (err: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const error = err as any;
        const detail = error?.response?.data?.detail;
        if (typeof detail === "string") {
            return detail;
        }
        if (Array.isArray(detail)) {
            return detail.map((item) => item?.msg || t("errorGeneric")).join(", ");
        }
        return t("tokenExpired");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!token) {
            setStatus("error");
            setMessage(t("missingTokenOnSubmit"));
            return;
        }

        if (password !== confirmPassword) {
            setStatus("error");
            setMessage(t("passwordMismatch"));
            return;
        }

        if (password.length < 8) {
            setStatus("error");
            setMessage(t("passwordMinLength"));
            return;
        }

        setStatus("loading");
        setMessage("");

        try {
            const res = await api.auth.resetPassword(token, password);
            setStatus("success");
            setMessage(res.message || t("successFallback"));
            
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
            <div className="mx-auto w-full max-w-md text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50">
                    <ShieldAlert className="h-8 w-8 text-rose-500" />
                </div>
                <h1 className="text-headline mb-2">{t("invalidLinkTitle")}</h1>
                <p className="text-body mb-6">{message}</p>
                <Link
                    href="/login"
                    className="inline-flex items-center justify-center w-full min-w-40 rounded-xl bg-gradient-primary px-6 py-3.5 font-bold text-white transition-opacity hover:opacity-90 shadow-lg shadow-blue-500/10"
                >
                    {t("backToLoginLink")}
                </Link>
            </div>
        );
    }

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

            {status === "success" ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center text-emerald-800">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h3 className="mb-2 text-xl font-bold text-emerald-900">{t("successTitle")}</h3>
                    <p className="mb-6">{message}</p>
                    <Link
                        href="/login"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-6 py-3.5 font-bold text-white transition-opacity hover:opacity-90 shadow-lg shadow-blue-500/10"
                    >
                        {t("loginNow")}
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
                            {t("passwordLabel")}
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
                            {t("confirmLabel")}
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
                        {status === "loading" ? t("loading") : t("submit")}
                        {!status && <ArrowRight className="h-5 w-5" />}
                    </button>
                </form>
            )}
        </div>
    );
}
