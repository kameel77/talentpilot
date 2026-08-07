"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { UserCog, Building2, ChevronRight } from "lucide-react";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { useAuthPanelRole } from "@/components/auth/AuthPanelContext";

type RoleType = "coach" | "personal" | "company" | null;

function RegisterContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations("auth.register");
    const { setRole: setPanelRole } = useAuthPanelRole();

    const [role, setRole] = useState<RoleType>(null);

    useEffect(() => {
        const paramRole = searchParams.get("role");
        if (paramRole === "coach" || paramRole === "personal" || paramRole === "company") {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRole(paramRole === "company" ? "personal" : paramRole);
        }
    }, [searchParams]);

    // Broadcast the selected role to the marketing panel (see AuthPanelContext),
    // and reset it back to the default copy when leaving the register page.
    useEffect(() => {
        setPanelRole(role === "coach" ? "coach" : role === "personal" ? "personal" : null);
        return () => setPanelRole(null);
    }, [role, setPanelRole]);

    const handleSelectRole = (selectedRole: "coach" | "personal") => {
        setRole(selectedRole);
        router.replace(`/register?role=${selectedRole}`);
    };

    const handleClearRole = () => {
        setRole(null);
        router.replace("/register");
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
                <h1 className="text-headline mb-2">{role ? t("title") : t("roleStepTitle")}</h1>
                <p className="text-body">
                    {t("subtitle")}
                </p>
            </div>

            <div className="animate-fade-up">
                {!role ? (
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={() => handleSelectRole("personal")}
                            className="w-full flex items-center gap-3 xl:gap-4 p-4 xl:p-5 rounded-2xl border border-slate-200 hover:border-primary hover:bg-blue-50/50 transition-all text-left group"
                        >
                            <div className="h-10 w-10 xl:h-12 xl:w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <Building2 className="w-5 h-5 xl:w-6 xl:h-6" />
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
                            className="w-full flex items-center gap-3 xl:gap-4 p-4 xl:p-5 rounded-2xl border border-slate-200 hover:border-primary hover:bg-purple-50/50 transition-all text-left group"
                        >
                            <div className="h-10 w-10 xl:h-12 xl:w-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <UserCog className="w-5 h-5 xl:w-6 xl:h-6" />
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
                ) : (
                    <RegisterForm role={role} onRoleChange={handleClearRole} />
                )}
            </div>

            <div className="mt-6 text-center text-sm text-slate-500 font-medium">
                {t("alreadyHaveAccount")}{" "}
                <Link href="/login" className="text-primary hover:text-blue-700 font-bold transition-colors">
                    {t("signIn")}
                </Link>
            </div>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={
            <div className="mx-auto flex w-full max-w-md items-center justify-center py-24">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        }>
            <RegisterContent />
        </Suspense>
    );
}
