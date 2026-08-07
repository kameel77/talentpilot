"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";

// Dev-only stub for the fake billing provider's hosted checkout page
// (backend/services/billing/fake_provider.py::create_checkout_session).
// Stands in for Stripe Checkout when BILLING_PROVIDER=fake — never used in
// production (the fake provider is refused there, see backend/config.py).
// Deliberately plain: this is a developer tool, not a customer-facing page.
export default function DevCheckoutPage() {
    const t = useTranslations("devCheckout");

    return (
        <Suspense fallback={<div className="p-8 text-sm text-slate-500">{t("processing")}</div>}>
            <DevCheckoutContent />
        </Suspense>
    );
}

function DevCheckoutContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations("devCheckout");

    const sessionId = searchParams.get("session");
    const organizationIdRaw = searchParams.get("org");
    const organizationId = organizationIdRaw ? Number(organizationIdRaw) : null;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const missingParams = !sessionId || !organizationId || Number.isNaN(organizationId);

    const handleOutcome = async (outcome: "success" | "failed") => {
        if (!sessionId || !organizationId) return;
        setLoading(true);
        setError("");
        try {
            await api.billing.checkoutCallback(sessionId, organizationId, outcome);
            router.push(`/dashboard?checkout=${outcome}`);
        } catch {
            setError(t("error"));
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 420, margin: "48px auto", padding: 24, fontFamily: "sans-serif" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{t("title")}</h1>
            <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>{t("subtitle")}</p>

            {missingParams ? (
                <p style={{ fontSize: 14, color: "#b91c1c" }}>{t("missingParams")}</p>
            ) : (
                <>
                    <div style={{ fontSize: 13, color: "#475569", marginBottom: 24 }}>
                        <div>
                            {t("sessionLabel")}: <code>{sessionId}</code>
                        </div>
                        <div>
                            {t("organizationLabel")}: <code>{organizationId}</code>
                        </div>
                    </div>

                    {error && (
                        <p style={{ fontSize: 14, color: "#b91c1c", marginBottom: 16 }}>{error}</p>
                    )}

                    <div style={{ display: "flex", gap: 12 }}>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleOutcome("success")}
                            style={{
                                padding: "10px 20px",
                                borderRadius: 8,
                                border: "none",
                                background: "#16a34a",
                                color: "#fff",
                                fontWeight: 600,
                                cursor: loading ? "not-allowed" : "pointer",
                                opacity: loading ? 0.6 : 1,
                            }}
                        >
                            {loading ? t("processing") : t("payButton")}
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleOutcome("failed")}
                            style={{
                                padding: "10px 20px",
                                borderRadius: 8,
                                border: "1px solid #cbd5e1",
                                background: "#fff",
                                color: "#334155",
                                fontWeight: 600,
                                cursor: loading ? "not-allowed" : "pointer",
                                opacity: loading ? 0.6 : 1,
                            }}
                        >
                            {loading ? t("processing") : t("declineButton")}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
