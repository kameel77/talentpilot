import type { ReactNode } from "react";

import { ArrowRight, MessageCircle, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const quickPrompts = [
    "Trudna rozmowa z zespołem",
    "Konflikt priorytetów",
    "Delegowanie bez mikrozarządzania",
    "Spadek motywacji",
];

const sampleActions = [
    "Zdefiniuj kryteria decyzji (15 min)",
    "Oceń 3 opcje wg kryteriów",
    "Zablokuj 1 wybór na 7 dni",
];

const sampleTalents = ["Strategic", "Activator", "Communication", "Empathy", "Achiever"];

export default function QACopilotPage() {
    return (
        <div className="space-y-8">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">Q&A Copilot</h1>
                    <p className="mt-1 text-slate-500 font-medium">
                        Zamień talent → kompetencję → akcję. Pytaj o swoje wyzwania lub współpracę w zespole.
                    </p>
                </div>
                <Button className="gap-2">
                    Nowe pytanie
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </header>

            <section className="grid gap-6 lg:grid-cols-2">
                <ContextCard
                    icon={<Sparkles className="h-5 w-5" />}
                    title="Moje talenty"
                    description="Rozwiąż problem w oparciu o swój profil talentów."
                    highlight="Priorytet: Twoje cele i blokery"
                />
                <ContextCard
                    icon={<Users className="h-5 w-5" />}
                    title="Współpraca w zespole"
                    description="Dopasuj komunikację i zadania do profilu talentów członka zespołu."
                    highlight="Priorytet: relacje i efektywna współpraca"
                />
            </section>

            <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
                <Card className="border-slate-200/70 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-xl">Rozmowa</CardTitle>
                            <CardDescription>Przykładowy dialog z mapowaniem Talent → Kompetencja → Akcja.</CardDescription>
                        </div>
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700">MVP v1</Badge>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <ChatBubble
                            variant="user"
                            title="Ty"
                            message="Odkładam trudne rozmowy z zespołem, bo boję się konfliktu."
                        />
                        <ChatBubble
                            variant="assistant"
                            title="Copilot"
                            message="Twój talent Strategic podpowiada, że unikasz decyzji bez jasnych kryteriów. Zamień to na konkretne działanie."
                        >
                            <div className="mt-4 space-y-3">
                                <ResponseBlock title="Talent" value="Strategic" tone="indigo" />
                                <ResponseBlock title="Kompetencja" value="Priorytetyzacja decyzji" tone="blue" />
                                <ResponseBlock title="Akcja (7 dni)" tone="emerald">
                                    <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                                        {sampleActions.map((action) => (
                                            <li key={action}>{action}</li>
                                        ))}
                                    </ul>
                                </ResponseBlock>
                            </div>
                        </ChatBubble>

                        <div className="flex flex-wrap gap-2">
                            {quickPrompts.map((prompt) => (
                                <Badge key={prompt} variant="outline" className="border-slate-200 text-slate-600">
                                    {prompt}
                                </Badge>
                            ))}
                        </div>

                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">Czy rekomendacja zadziałała?</p>
                                    <p className="text-xs text-slate-500">Zbieramy feedback, by uczyć model po MVP.</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm">Nie</Button>
                                    <Button size="sm">Tak</Button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Textarea
                                placeholder="Zadaj pytanie (np. Jak przygotować feedback dla osoby z talentem Empatia?)"
                                className="min-h-[96px]"
                            />
                            <div className="flex justify-end">
                                <Button className="gap-2">
                                    Wyślij
                                    <MessageCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="border-slate-200/70 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Kontekst talentów</CardTitle>
                            <CardDescription>Top talenty użyte do rekomendacji.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                            {sampleTalents.map((talent) => (
                                <Badge key={talent} className="bg-slate-900 text-white">
                                    {talent}
                                </Badge>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200/70 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Współpraca z zespołem</CardTitle>
                            <CardDescription>Wybierz osobę i temat rozmowy.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <TeamMemberCard name="Anna Kowalska" role="Product Lead" talents={["Empathy", "Developer"]} />
                            <TeamMemberCard name="Piotr Nowak" role="Sales Manager" talents={["Activator", "Woo"]} />
                            <Button variant="outline" className="w-full">Zobacz pełny zespół</Button>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Fallback bez talentów</CardTitle>
                            <CardDescription>
                                Gdy brakuje profilu talentów, Copilot podaje ogólne kroki i zachęca do uzupełnienia danych.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-xl border border-amber-200 bg-white p-4 text-sm text-slate-700">
                                <p className="font-semibold">Sugerowane działania:</p>
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li>Ustal cel rozmowy i kluczowe fakty.</li>
                                    <li>Zapytaj o perspektywę drugiej strony.</li>
                                    <li>Ustal następny krok i termin.</li>
                                </ul>
                            </div>
                            <Button variant="outline" className="mt-4 w-full">Uzupełnij talenty</Button>
                        </CardContent>
                    </Card>
                </div>
            </section>
        </div>
    );
}

interface ContextCardProps {
    icon: ReactNode;
    title: string;
    description: string;
    highlight: string;
}

function ContextCard({ icon, title, description, highlight }: ContextCardProps) {
    return (
        <Card className="border-slate-200/70 shadow-sm">
            <CardHeader className="flex flex-row items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
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

interface ChatBubbleProps {
    variant: "user" | "assistant";
    title: string;
    message: string;
    children?: ReactNode;
}

function ChatBubble({ variant, title, message, children }: ChatBubbleProps) {
    const isUser = variant === "user";

    return (
        <div className={cn("flex flex-col gap-3", isUser ? "items-end" : "items-start")}>
            <div className={cn(
                "max-w-2xl rounded-2xl px-5 py-4 text-sm shadow-sm",
                isUser ? "bg-blue-600 text-white" : "bg-white border border-slate-200/70 text-slate-700"
            )}
            >
                <p className={cn("text-xs font-semibold uppercase tracking-widest", isUser ? "text-blue-100" : "text-slate-400")}>
                    {title}
                </p>
                <p className="mt-2 leading-relaxed">{message}</p>
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

function ResponseBlock({ title, value, tone, children }: ResponseBlockProps) {
    const toneStyles = {
        indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
        blue: "bg-blue-50 text-blue-700 border-blue-100",
        emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    };

    return (
        <div className={cn("rounded-2xl border px-4 py-3 text-sm", toneStyles[tone])}>
            <p className="text-xs font-semibold uppercase tracking-widest">{title}</p>
            {value && <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>}
            {children}
        </div>
    );
}

interface TeamMemberCardProps {
    name: string;
    role: string;
    talents: string[];
}

function TeamMemberCard({ name, role, talents }: TeamMemberCardProps) {
    return (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
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
