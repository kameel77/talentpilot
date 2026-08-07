"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api, tokenManager } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

interface RegisterFormProps {
    role: "coach" | "personal" | "company";
    onRoleChange: () => void;
}

export function RegisterForm({ role, onRoleChange }: RegisterFormProps) {
    const router = useRouter();
    const t = useTranslations("auth.register");
    const tCoach = useTranslations("auth.registerCoach");

    const [formData, setFormData] = useState({
        full_name: "",
        email: "",
        password: "",
    });
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
        return t("registrationFailed");
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
            if (role === "coach") {
                const { access_token } = await api.auth.registerCoach(formData);
                tokenManager.setToken(access_token);
                const user = await api.auth.getCurrentUser();
                tokenManager.setUser(user);
                document.cookie = "onboarding=1; path=/; max-age=3600; SameSite=Lax";
                router.push("/dashboard/onboarding");
            } else {
                const { access_token } = await api.auth.register(formData);
                tokenManager.setToken(access_token);
                const user = await api.auth.getCurrentUser();
                tokenManager.setUser(user);
                router.push("/dashboard");
            }
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* Selected role chip */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                <span className="text-xs font-semibold text-slate-700">
                    {role === "coach" ? t("roleChipCoach") : t("roleChipPersonal")}
                </span>
                <button
                    type="button"
                    onClick={onRoleChange}
                    className="text-xs font-bold text-primary hover:underline transition-all"
                >
                    {t("roleChange")}
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                        {typeof error === "string" ? error : JSON.stringify(error)}
                    </div>
                )}

                <div className="space-y-1.5">
                    <label htmlFor="full_name" className="block text-sm font-semibold text-slate-700 ml-1">
                        {t("nameLabel")}
                    </label>
                    <input
                        id="full_name"
                        name="full_name"
                        type="text"
                        value={formData.full_name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white focus:border-transparent transition-all outline-none text-slate-900"
                        placeholder="Jan Kowalski"
                    />
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="email" className="block text-sm font-semibold text-slate-700 ml-1">
                        {t("emailLabel")}
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
                        {t("passwordLabel")}
                    </label>
                    <div className="relative">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={handleChange}
                            required
                            minLength={8}
                            className="w-full px-4 py-3 pr-11 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white focus:border-transparent transition-all outline-none text-slate-900"
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
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight ml-1">{t("passwordMinLength")}</p>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white py-3.5 mt-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                    {loading
                        ? t("loading")
                        : role === "coach"
                        ? tCoach("submit")
                        : t("submit")}
                </button>
            </form>
        </div>
    );
}
