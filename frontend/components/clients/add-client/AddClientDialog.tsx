"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AddClientFlow, ClientType } from "./AddClientFlow";

interface AddClientDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialType?: ClientType;
    /** Called after every persisted change (company, team or person created). */
    onChange?: () => void;
}

/**
 * Dialog shell of the add-client flow. The flow unmounts on close,
 * so every opening starts from a clean state.
 */
export function AddClientDialog({ open, onOpenChange, initialType, onChange }: AddClientDialogProps) {
    const t = useTranslations("addClient");
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl">{t("dialogTitle")}</DialogTitle>
                    <DialogDescription>{t("dialogDescription")}</DialogDescription>
                </DialogHeader>
                {open && (
                    <AddClientFlow
                        initialType={initialType}
                        onChange={onChange}
                        onClose={() => onOpenChange(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
