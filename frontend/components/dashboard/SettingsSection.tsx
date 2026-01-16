import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  icon: React.ElementType;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
  className
}: SettingsSectionProps) {
  return (
    <div className={cn("rounded-3xl border border-slate-200/60 bg-white p-8 shadow-sm transition hover:shadow-md", className)}>
      <div className="flex items-start gap-4 mb-6">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-title">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
