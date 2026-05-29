"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Keyboard } from "lucide-react";
import { ManualTalentInput } from "./ManualTalentInput";
import { PdfTalentImport } from "./PdfTalentImport";
import { UserTalent } from "@/types/talent";

interface TalentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (talents: UserTalent[]) => void;
  initialTalents?: UserTalent[];
  memberName?: string;
  userId?: number;
  onUsersChange?: () => void;
}

export function TalentImportDialog({
  open,
  onOpenChange,
  onSave,
  initialTalents = [],
  memberName,
  userId,
  onUsersChange
}: TalentImportDialogProps) {
  const t = useTranslations('talentImport');
  const [activeTab, setActiveTab] = useState<'pdf' | 'manual'>('pdf');
  const [prefilledTalents, setPrefilledTalents] = useState<UserTalent[]>(initialTalents);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) {
        setActiveTab('pdf');
        setPrefilledTalents(initialTalents);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [open, initialTalents]);

  const handlePdfImportComplete = (talents: UserTalent[]) => {
    onSave(talents);
    onOpenChange(false);
  };

  const handleSwitchToManual = (talents: UserTalent[]) => {
    setPrefilledTalents(talents);
    setActiveTab('manual');
  };

  const handleManualSave = (talents: UserTalent[]) => {
    onSave(talents);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {memberName ? `${t('title')}: ${memberName}` : t('title')}
          </DialogTitle>
          <DialogDescription>
            Zaimportuj talenty z raportu PDF lub wprowadź je ręcznie
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pdf' | 'manual')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pdf" className="gap-2">
              <FileText className="h-4 w-4" />
              {t('pdfTab')}
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <Keyboard className="h-4 w-4" />
              {t('manualTab')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pdf" className="mt-6">
            <PdfTalentImport
              userId={userId}
              onUsersChange={onUsersChange}
              onImportComplete={handlePdfImportComplete}
              onSwitchToManual={handleSwitchToManual}
            />
          </TabsContent>

          <TabsContent value="manual" className="mt-6">
            <ManualTalentInput
              onSave={handleManualSave}
              initialTalents={prefilledTalents}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
