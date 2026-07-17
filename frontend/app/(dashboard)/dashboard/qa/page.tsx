"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle, Sparkles, Users, Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api, tokenManager, QAAnswer, User, UserTalentResponse } from "@/lib/api";
import { getLocaleFromCookie } from "@/lib/locale";
import { ChatBubble, ContextCard, TeamMemberCard } from "@/components/qa/QAComponents";
import { getRenderer } from "@/components/qa/QARenderers";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    answer?: QAAnswer;
    answer_raw?: string;
    render_mode?: string;
    query_id?: number;
    answer_id?: number;
    feedback_sent?: boolean;
}

export default function QACopilotPage() {
    const t = useTranslations("qa");
    const isCoach = tokenManager.getUser()?.role === 'coach';

    const quickPrompts = [
        t("prompt1"),
        t("prompt2"),
        t("prompt3"),
        t("prompt4"),
    ];

    const [context, setContext] = useState<"self" | "team">("self");
    const [question, setQuestion] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [myTalents, setMyTalents] = useState<string[]>([]);
    const [teamMembers, setTeamMembers] = useState<User[]>([]);
    const [selectedMember, setSelectedMember] = useState<User | null>(null);
    const [teamNames, setTeamNames] = useState<string[]>([]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const user = api.tokenManager.getUser();
                const names: string[] = [];
                if (user) {
                    const firstName = user.full_name.split(" ")[0];
                    if (firstName) names.push(firstName);
                    const talents = await api.talents.getUserTalents(user.id);
                    setMyTalents(talents.map((t: UserTalentResponse) => t.talent.translation.name));
                }
                const members = await api.users.list();
                setTeamMembers(members.filter((m: User) => m.id !== api.tokenManager.getUser()?.id));

                members.forEach((m: User) => {
                    const firstName = m.full_name.split(" ")[0];
                    if (firstName && !names.includes(firstName)) {
                        names.push(firstName);
                    }
                });
                setTeamNames(names);

                try {
                    const history = await api.qa.getHistory();
                    setMessages(history.map(item => ({
                        role: "assistant",
                        content: `Historyczne pytanie: ${item.question}`,
                        answer: item.answer,
                        answer_raw: item.answer_raw || "",
                        render_mode: item.render_mode || "structured",
                        query_id: item.query_id,
                        feedback_sent: true
                    })));
                } catch (hErr) {
                    console.error("Failed to load history", hErr);
                }
            } catch (err) {
                console.error("Failed to load initial data", err);
            }
        };
        loadInitialData();
    }, []);

    const handleSend = async () => {
        if (!question.trim()) return;

        const currentMsg = question;
        setQuestion("");
        setIsLoading(true);

        const newMessages: ChatMessage[] = [
            ...messages,
            { role: "user", content: currentMsg }
        ];
        setMessages(newMessages);

        try {
            const res = await api.qa.query({
                context,
                question: currentMsg,
                target_user_id: context === "team" ? selectedMember?.id : undefined,
                language: getLocaleFromCookie()
            });

            setMessages([
                ...newMessages,
                {
                    role: "assistant",
                    content: context === "self"
                        ? t("answerPrefixSelf")
                        : t("answerPrefixTeam", { name: selectedMember?.full_name ?? "" }),
                    answer: res.answer,
                    answer_raw: res.answer_raw || "",
                    render_mode: res.render_mode || "structured",
                    query_id: res.query_id,
                    answer_id: res.answer_id
                }
            ]);
        } catch (err) {
            console.error("Failed to fetch answer", err);
            alert(t("errorGeneric"));
        } finally {
            setIsLoading(false);
        }
    };

    const handleFeedback = async (msgIndex: number, isEffective: boolean, rating?: number) => {
        const msg = messages[msgIndex];
        if (!msg.query_id || !msg.answer_id) return;

        try {
            await api.qa.submitFeedback({
                query_id: msg.query_id,
                answer_id: msg.answer_id,
                is_effective: isEffective,
                rating: rating
            });

            const updatedMessages = [...messages];
            updatedMessages[msgIndex] = { ...msg, feedback_sent: true };
            setMessages(updatedMessages);
        } catch (err) {
            console.error("Failed to submit feedback", err);
        }
    };

    return (
        <div className="max-w-5xl mx-auto w-full space-y-8">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">{t("title")}</h1>
                    <p className="mt-1 text-slate-500 font-medium">
                        {isCoach ? t("subtitleCoach") : t("subtitle")}
                    </p>
                </div>
                <Button variant="outline" onClick={() => setMessages([])} className="gap-2">
                    {t("clearChat")}
                </Button>
            </header>

            <section className="grid gap-6 lg:grid-cols-2">
                <ContextCard
                    icon={<Sparkles className="h-5 w-5" />}
                    title={t("contextSelfTitle")}
                    description={t("contextSelfDesc")}
                    highlight={t("contextSelfHighlight")}
                    active={context === "self"}
                    onClick={() => setContext("self")}
                />
                <ContextCard
                    icon={<Users className="h-5 w-5" />}
                    title={t("contextTeamTitle")}
                    description={t("contextTeamDesc")}
                    highlight={t("contextTeamHighlight")}
                    active={context === "team"}
                    onClick={() => setContext("team")}
                />
            </section>

            <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
                <Card className="border-slate-200/70 shadow-sm flex flex-col min-h-[600px]">
                    <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 py-4">
                        <div>
                            <CardTitle className="text-lg">{t("history")}</CardTitle>
                            <CardDescription>
                                {context === "self"
                                    ? t("chatDescSelf")
                                    : t("chatDescTeam", { name: selectedMember?.full_name ?? t("selectPerson") })}
                            </CardDescription>
                        </div>
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700">MVP v1</Badge>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-60">
                                <MessageCircle className="h-12 w-12 text-blue-200" />
                                <p className="text-slate-500 max-w-xs">
                                    {t("noHistory")}
                                </p>
                            </div>
                        )}

                        {messages.map((msg, idx) => {
                            const Renderer = getRenderer(msg.render_mode || "structured");
                            return (
                                <div key={idx} className="space-y-4">
                                    <ChatBubble
                                        variant={msg.role}
                                        title={msg.role === "user" ? t("you") : "Copilot"}
                                        message={msg.content}
                                    >
                                        {msg.answer && (
                                            <>
                                                <Renderer
                                                    answer={msg.answer}
                                                    answerRaw={msg.answer_raw || ""}
                                                    teamNames={teamNames}
                                                />

                                                {!msg.feedback_sent && (
                                                    <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="text-sm font-semibold text-slate-900">{t("feedbackQuestion")}</p>
                                                                <p className="text-xs text-slate-500">{t("feedbackHint")}</p>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Button variant="outline" size="sm" onClick={() => handleFeedback(idx, false)}>{t("notHelpful")}</Button>
                                                                <Button size="sm" onClick={() => handleFeedback(idx, true)}>{t("helpful")}</Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </ChatBubble>
                                </div>
                            );
                        })}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-200/70 p-4 rounded-2xl shadow-sm flex items-center gap-3">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                    <span className="text-sm text-slate-500">{t("sending")}</span>
                                </div>
                            </div>
                        )}
                    </CardContent>

                    <div className="p-6 border-t bg-slate-50/30">
                        <div className="mb-4 flex flex-wrap gap-2">
                            {quickPrompts.map((prompt) => (
                                <Badge
                                    key={prompt}
                                    variant="outline"
                                    className="border-slate-200 text-slate-600 cursor-pointer hover:bg-white"
                                    onClick={() => setQuestion(prompt)}
                                >
                                    {prompt}
                                </Badge>
                            ))}
                        </div>

                        <div className="relative">
                            <Textarea
                                placeholder={context === "self"
                                    ? t("placeholder")
                                    : t("placeholderTeam", { name: selectedMember?.full_name ?? t("team") })}
                                className="min-h-[100px] pr-12 rounded-2xl shadow-sm border-slate-200 focus:ring-blue-500"
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                            />
                            <Button
                                size="icon"
                                className="absolute bottom-3 right-3 h-8 w-8 rounded-full"
                                disabled={isLoading || !question.trim() || (context === "team" && !selectedMember)}
                                onClick={handleSend}
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </Card>

                <div className="space-y-6">
                    <Card className="border-slate-200/70 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">{t("talentContext")}</CardTitle>
                            <CardDescription>{t("talentContextDesc")}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                            {myTalents.length > 0 ? myTalents.map((talent) => (
                                <Badge key={talent} className="bg-slate-900 text-white">
                                    {talent}
                                </Badge>
                            )) : (
                                <p className="text-sm text-slate-500 italic">{t("noTalents")}</p>
                            )}
                        </CardContent>
                    </Card>

                    {context === "team" && (
                        <Card className="border-slate-200/70 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">{t("contextTeamTitle")}</CardTitle>
                                <CardDescription>{t("selectPersonDesc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                {teamMembers.map((member) => (
                                    <TeamMemberCard
                                        key={member.id}
                                        name={member.full_name}
                                        role={member.job_title || "Team Member"}
                                        talents={[]} // For now talents are not easily visible in list
                                        selected={selectedMember?.id === member.id}
                                        onClick={() => setSelectedMember(member)}
                                    />
                                ))}
                                {teamMembers.length === 0 && <p className="text-sm text-slate-500">{t("noMembers")}</p>}
                            </CardContent>
                        </Card>
                    )}

                    {messages.some(m => m.answer?.fallback) && (
                        <Card className="border-amber-200 bg-amber-50/60 shadow-sm animate-in fade-in zoom-in-95">
                            <CardHeader>
                                <CardTitle className="text-lg">{t("fallbackTitle")}</CardTitle>
                                <CardDescription>
                                    {t("fallbackDesc")}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button variant="outline" className="w-full">{t("addTalents")}</Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </section>
        </div>
    );
}
