"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { UserCog, Building2, ChevronRight } from "lucide-react";
import { RegisterForm } from "@/components/auth/RegisterForm";

type RoleType = "coach" | "personal" | "company" | null;

function RegisterContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations("auth.register");

    const [role, setRole] = useState<RoleType>(null);

    useEffect(() => {
        const paramRole = searchParams.get("role");
        if (paramRole === "coach" || paramRole === "personal" || paramRole === "company") {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRole(paramRole === "company" ? "personal" : paramRole);
        }
    }, [searchParams]);

    const handleSelectRole = (selectedRole: "coach" | "personal") => {
        setRole(selectedRole);
        router.replace(`/register?role=${selectedRole}`);
    };

    const handleClearRole = () => {
        setRole(null);
        router.replace("/register");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold font-heading text-primary tracking-tight">
                        TalentPilot
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">{t("subtitle")}</p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl shadow-blue-500/5 border border-slate-200 p-8 sm:p-10 animate-fade-up">
                    {!role ? (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h2 className="text-xl font-bold text-slate-900">
                                    {t("roleStepTitle")}
                                </h2>
                            </div>

                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={() => handleSelectRole("personal")}
                                    className="w-full flex items-center gap-4 p-5 rounded-2xl border border-slate-200 hover:border-primary hover:bg-blue-50/50 transition-all text-left group"
                                >
                                    <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-900 text-base">
                                            {t("rolePersonal")}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                            {t("rolePersonalDesc")}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSelectRole("coach")}
                                    className="w-full flex items-center gap-4 p-5 rounded-2xl border border-slate-200 hover:border-primary hover:bg-purple-50/50 transition-all text-left group"
                                >
                                    <div className="h-12 w-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                        <UserCog className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-900 text-base">
                                            {t("roleCoach")}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                            {t("roleCoachDesc")}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <RegisterForm role={role} onRoleChange={handleClearRole} />
                    )}

                    <div className="mt-8 text-center text-sm text-slate-500 font-medium">
                        {t("alreadyHaveAccount")}{" "}
                        <Link href="/login" className="text-primary hover:text-blue-700 font-bold transition-colors">
                            {t("signIn")}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        }>
            <RegisterContent />
        </Suspense>
    );
}
