import { cn } from "@/lib/utils";

export type DomainType = "Realizacja" | "Wpływanie" | "Budowanie relacji" | "Myślenie strategiczne";

interface DomainBadgeProps {
    domain: DomainType;
    className?: string;
    size?: "sm" | "md";
}

const domainStyles: Record<DomainType, { bg: string, text: string, border: string, dot: string }> = {
    "Realizacja": {
        bg: "bg-indigo-50",
        text: "text-indigo-700",
        border: "border-indigo-100",
        dot: "bg-indigo-500"
    },
    "Wpływanie": {
        bg: "bg-orange-50",
        text: "text-orange-700",
        border: "border-orange-100",
        dot: "bg-orange-500"
    },
    "Budowanie relacji": {
        bg: "bg-teal-50",
        text: "text-teal-700",
        border: "border-teal-100",
        dot: "bg-teal-500"
    },
    "Myślenie strategiczne": {
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-100",
        dot: "bg-blue-500"
    },
};

export function DomainBadge({ domain, className, size = "md" }: DomainBadgeProps) {
    const style = domainStyles[domain];

    return (
        <span
            className={cn(
                "inline-flex items-center font-bold border transition-colors",
                style.bg,
                style.text,
                style.border,
                size === "sm" ? "px-2 py-0.5 text-[10px] rounded-full" : "px-3 py-1 text-xs rounded-full",
                className
            )}
        >
            <span className={cn(
                "w-1 h-1 rounded-full mr-1.5",
                style.dot
            )} />
            {domain}
        </span>
    );
}
