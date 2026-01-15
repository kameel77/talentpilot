import { KPICard } from "@/components/ui/KPICard";
import { DomainBadge } from "@/components/ui/DomainBadge";
import {
    Users,
    Database,
    ArrowRightLeft,
    TrendingUp,
    ChevronRight,
    ArrowRight,
    Sparkles
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">Panel główny</h1>
                    <p className="mt-1 text-slate-500 font-medium">
                        Witaj, Anno! Oto przegląd Twojego zespołu.
                    </p>
                </div>
                <button className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/25 hover:bg-primary-dark transition-all group">
                    Zarządzaj zespołem
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Członków zespołu"
                    value="5"
                    icon={<Users className="h-5 w-5" />}
                    description="aktywnych użytkowników"
                    trend={{ value: "12%", isUp: true }}
                />
                <KPICard
                    title="Zaimportowane talenty"
                    value="25"
                    icon={<Database className="h-5 w-5" />}
                    description="profili talentowych"
                />
                <KPICard
                    title="Porównań 1:1"
                    value="12"
                    icon={<ArrowRightLeft className="h-5 w-5" />}
                    description="w tym miesiącu"
                    trend={{ value: "8%", isUp: true }}
                />
                <KPICard
                    title="Zaangażowanie"
                    value="87%"
                    icon={<TrendingUp className="h-5 w-5" />}
                    description="średnia aktywność"
                    trend={{ value: "5%", isUp: true }}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Domain Area */}
                <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                    <h3 className="text-xl font-bold font-heading text-slate-900 mb-6 tracking-tight">
                        Rozkład domenowy zespołu
                    </h3>

                    <div className="space-y-6">
                        <DomainProgress label="Realizacja" value={35} color="bg-indigo-500" />
                        <DomainProgress label="Wpływanie" value={25} color="bg-orange-500" />
                        <DomainProgress label="Budowanie relacji" value={22} color="bg-teal-500" />
                        <DomainProgress label="Myślenie strategiczne" value={18} color="bg-blue-500" />
                    </div>

                    <div className="mt-8 flex gap-3">
                        <div className="h-10 grow bg-indigo-500 rounded-xl" />
                        <div className="h-10 grow bg-orange-500 rounded-xl" />
                        <div className="h-10 grow bg-teal-500 rounded-xl" />
                        <div className="h-10 grow bg-blue-500 rounded-xl" />
                    </div>
                </div>

                {/* Daily Tip Area */}
                <div className="lg:col-span-8 bg-blue-50/50 rounded-3xl border border-blue-100/50 p-8 flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm ring-1 ring-blue-100">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                                    Dzienna wskazówka
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold">
                                    Realizacja
                                </span>
                            </div>
                            <h4 className="text-xl font-bold text-slate-900 font-heading tracking-tight">
                                Wskazówka na spotkanie z Anną
                            </h4>
                        </div>
                    </div>

                    <p className="text-lg text-slate-600 leading-relaxed max-w-2xl">
                        Anna ma silny talent Osiągania. Przed spotkaniem przygotuj konkretne cele i rezultaty, które chcesz osiągnąć. Doceni jasną strukturę i możliwość od razu przejścia do działania.
                    </p>

                    <div className="mt-auto pt-8">
                        <button className="flex items-center gap-2 text-sm font-bold text-slate-900 hover:gap-3 transition-all">
                            Zobacz więcej wskazówek
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Team Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">Twój zespół</h3>
                    <Link href="/dashboard/users" className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
                        Zobacz wszystkich
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MemberCard
                        name="Anna Kowalska"
                        role="Menedżer"
                        domains={["Realizacja", "Myślenie strategiczne"]}
                        initials="AK"
                    />
                    <MemberCard
                        name="Piotr Nowak"
                        role="Członek Zespołu"
                        domains={["Budowanie relacji"]}
                        initials="PN"
                    />
                    <MemberCard
                        name="Magdalena Wiśniewska"
                        role="Członek Zespołu"
                        domains={["Myślenie strategiczne", "Wpływanie"]}
                        initials="MW"
                    />
                </div>
            </div>
        </div>
    );
}

function DomainProgress({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-700">{label}</span>
                <span className="text-slate-400 font-medium">{value}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${value}%` }} />
            </div>
        </div>
    );
}

function MemberCard({ name, role, domains, initials }: { name: string, role: string, domains: string[], initials: string }) {
    return (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg transition-all">
            <div className="flex items-center gap-4 mb-6">
                <div className="h-14 w-14 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-xl relative">
                    {initials}
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-amber-400 border-4 border-white rounded-full flex items-center justify-center">
                        <Sparkles className="h-3 w-3 text-white" />
                    </div>
                </div>
                <div>
                    <h4 className="font-bold text-slate-900 group-hover:text-primary transition-colors">{name}</h4>
                    <p className="text-xs text-slate-500 font-medium">{role}</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {domains.map(d => (
                    <DomainBadge key={d} domain={d as any} size="sm" />
                ))}
                {domains.length > 2 && (
                    <span className="text-[10px] font-bold text-slate-400">+2 więcej</span>
                )}
            </div>
        </div>
    )
}
