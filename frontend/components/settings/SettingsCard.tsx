import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SettingsCardProps {
    title: string;
    description?: string;
    /** Optional control rendered on the right of the header (badge, link, button). */
    aside?: ReactNode;
    children: ReactNode;
    className?: string;
}

export function SettingsCard({ title, description, aside, children, className }: SettingsCardProps) {
    return (
        <section
            className={cn(
                "rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6",
                className
            )}
        >
            <div className="mb-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                    {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
                </div>
                {aside && <div className="shrink-0">{aside}</div>}
            </div>
            {children}
        </section>
    );
}
