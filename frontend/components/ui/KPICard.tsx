import { cn } from "@/lib/utils";
import React from "react";

interface KPICardProps {
    title: string;
    value: string | number;
    description?: string;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    icon?: React.ReactNode;
    className?: string;
}

export function KPICard({ title, value, description, trend, icon, className }: KPICardProps) {
    return (
        <div className={cn("rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md", className)}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    <h3 className="mt-1 text-2xl font-bold font-heading text-slate-900">{value}</h3>

                    {description && (
                        <p className="mt-1 text-xs text-slate-400">{description}</p>
                    )}

                    {trend && (
                        <div className={cn(
                            "mt-2 flex items-center text-xs font-medium",
                            trend.isPositive ? "text-emerald-600" : "text-rose-600"
                        )}>
                            <span>{trend.isPositive ? "↑" : "↓"} {trend.value}%</span>
                            <span className="ml-1 text-slate-400 font-normal">vs last month</span>
                        </div>
                    )}
                </div>

                {icon && (
                    <div className="rounded-xl bg-slate-50 p-2.5 text-slate-600">
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
}
