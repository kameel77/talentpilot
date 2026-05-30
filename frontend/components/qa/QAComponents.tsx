"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ChatBubbleProps {
    variant: "user" | "assistant";
    title: string;
    message: string;
    children?: ReactNode;
}

export function ChatBubble({ variant, title, message, children }: ChatBubbleProps) {
    const isUser = variant === "user";

    return (
        <div className={cn("flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2", isUser ? "items-end" : "items-start")}>
            <div className={cn(
                "max-w-2xl rounded-2xl px-5 py-4 text-sm shadow-sm",
                isUser ? "bg-blue-600 text-white" : "bg-white border border-slate-200/70 text-slate-700"
            )}
            >
                <p className={cn("text-xs font-semibold uppercase tracking-widest", isUser ? "text-blue-100" : "text-slate-400")}>
                    {title}
                </p>
                <p className="mt-2 leading-relaxed whitespace-pre-wrap">{message}</p>
                {children}
            </div>
        </div>
    );
}

interface ResponseBlockProps {
    title: string;
    value?: string;
    tone: "indigo" | "blue" | "emerald";
    children?: ReactNode;
}

export function ResponseBlock({ title, value, tone, children }: ResponseBlockProps) {
    const toneStyles = {
        indigo: "bg-indigo-50/50 text-indigo-950 border-indigo-100/80",
        blue: "bg-blue-50/50 text-blue-950 border-blue-100/80",
        emerald: "bg-emerald-50/40 text-emerald-950 border-emerald-100/70",
    };

    const titleColor = {
        indigo: "text-indigo-600/90",
        blue: "text-blue-600/90",
        emerald: "text-emerald-700/90",
    };

    return (
        <div className={cn("rounded-2xl border px-4 py-3.5 text-sm transition-all shadow-sm/5", toneStyles[tone])}>
            <p className={cn("text-[10px] font-bold uppercase tracking-wider", titleColor[tone])}>{title}</p>
            {value && <p className="mt-1 text-sm font-bold text-slate-900 leading-tight">{value}</p>}
            {children}
        </div>
    );
}

interface ContextCardProps {
    icon: ReactNode;
    title: string;
    description: string;
    highlight: string;
    active?: boolean;
    onClick?: () => void;
}

export function ContextCard({ icon, title, description, highlight, active, onClick }: ContextCardProps) {
    return (
        <Card
            className={cn(
                "border-slate-200/70 shadow-sm cursor-pointer transition-all hover:border-blue-400",
                active && "border-blue-500 ring-1 ring-blue-500 bg-blue-50/10"
            )}
            onClick={onClick}
        >
            <CardHeader className="flex flex-row items-start gap-4">
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600", active && "bg-blue-100")}>
                    {icon}
                </div>
                <div>
                    <CardTitle className="text-xl">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4 text-sm text-slate-600">
                    {highlight}
                </div>
            </CardContent>
        </Card>
    );
}

interface TeamMemberCardProps {
    name: string;
    role: string;
    talents: string[];
    selected?: boolean;
    onClick?: () => void;
}

export function TeamMemberCard({ name, role, talents, selected, onClick }: TeamMemberCardProps) {
    return (
        <div
            className={cn(
                "rounded-2xl border border-slate-200/70 bg-white p-4 cursor-pointer transition-all hover:border-blue-300",
                selected && "border-blue-500 ring-1 ring-blue-500"
            )}
            onClick={onClick}
        >
            <p className="text-sm font-semibold text-slate-900">{name}</p>
            <p className="text-xs text-slate-500">{role}</p>
            <div className="mt-3 flex flex-wrap gap-2">
                {talents.map((talent) => (
                    <Badge key={talent} variant="secondary" className="bg-slate-100 text-slate-600">
                        {talent}
                    </Badge>
                ))}
            </div>
        </div>
    );
}
