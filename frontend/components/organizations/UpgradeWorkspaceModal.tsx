"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

interface UpgradeWorkspaceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    organizationId: number;
    onSuccess: () => void;
}

export function UpgradeWorkspaceModal({
    open,
    onOpenChange,
    organizationId,
    onSuccess,
}: UpgradeWorkspaceModalProps) {
    const t = useTranslations("upgradeWorkspace");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;

        setLoading(true);
        setError("");

        try {
            await api.organizations.upgrade(organizationId, { name: trimmed });
            setName("");
            onOpenChange(false);
            onSuccess();
        } catch {
            setError(t("error"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[440px] rounded-3xl p-6 sm:p-8">
                <DialogHeader className="space-y-3 text-left">
                    <div className="h-12 w-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <DialogTitle className="text-xl font-bold font-heading text-slate-900">
                        {t("title")}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500 font-medium leading-relaxed">
                        {t("description")}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 pt-2">
                    {error && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="org-upgrade-name" className="text-xs font-bold text-slate-700">
                            {t("nameLabel")}
                        </Label>
                        <Input
                            id="org-upgrade-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t("placeholder")}
                            required
                            autoFocus
                            className="rounded-xl"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                            className="rounded-xl font-semibold"
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !name.trim()}
                            className="rounded-xl font-bold px-6"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("submit")}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
