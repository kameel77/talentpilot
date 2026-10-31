"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
    ArrowLeft,
    ArrowRight,
    Building,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    MonitorPlay,
    Plus,
    User as UserIcon,
} from "lucide-react";
import { api, tokenManager } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PersonForm } from "./PersonForm";
import { PdfBatchImport } from "./PdfBatchImport";
import { AddedPerson, CopyProfileLinkButton, Stepper } from "./shared";

export type ClientType = "person" | "org";
type Step = "type" | "person" | "org" | "people" | "done";

export interface AddClientResume {
    orgId: number;
    orgName: string;
    teamId?: number | null;
    teamName?: string;
}

interface AddClientFlowProps {
    /** Preselects the client type; the coach can still go back to the type choice. */
    initialType?: ClientType;
    /** Continue an unfinished company setup (onboarding resume). */
    resume?: AddClientResume;
    /** Called after every persisted change, so the host can refresh its lists. */
    onChange?: () => void;
    /** When set, the done screen offers a "Close" action (dialog shell). */
    onClose?: () => void;
    /** Called right before the flow navigates away (e.g. to clear the onboarding cookie). */
    onLeave?: () => void;
}

const INPUT_CLASS =
    "w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-slate-900 disabled:bg-slate-50 disabled:text-slate-500";

function initialStep(initialType?: ClientType, resume?: AddClientResume): Step {
    if (resume) return resume.teamId ? "people" : "org";
    if (initialType === "person") return "person";
    if (initialType === "org") return "org";
    return "type";
}

export function AddClientFlow({ initialType, resume, onChange, onClose, onLeave }: AddClientFlowProps) {
    const t = useTranslations("addClient");
    const router = useRouter();

    const [type, setType] = useState<ClientType | null>(resume ? "org" : initialType ?? null);
    const [step, setStep] = useState<Step>(initialStep(initialType, resume));

    // Company path
    const [orgId, setOrgId] = useState<number | null>(resume?.orgId ?? null);
    const [orgName, setOrgName] = useState(resume?.orgName ?? "");
    const [teamId, setTeamId] = useState<number | null>(resume?.teamId ?? null);
    const [teamName, setTeamName] = useState(resume?.teamName ?? t("defaultTeamName"));
    const [teamPeople, setTeamPeople] = useState<AddedPerson[]>([]);
    const [showSingleForm, setShowSingleForm] = useState(false);

    // Person path
    const [person, setPerson] = useState<AddedPerson | null>(null);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const individualsOrgId = tokenManager.getUser()?.organization_id ?? null;

    const chooseType = async (next: ClientType) => {
        // Surface the plan-limit modal before the coach types anything.
        if (!(await api.billing.checkLimit(next === "org" ? "client_orgs" : "profiles"))) return;
        setType(next);
        setError("");
        setStep(next === "person" ? "person" : "org");
    };

    const resetAll = () => {
        setType(null);
        setStep("type");
        setOrgId(null);
        setOrgName("");
        setTeamId(null);
        setTeamName(t("defaultTeamName"));
        setTeamPeople([]);
        setShowSingleForm(false);
        setPerson(null);
        setError("");
    };

    const submitOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgName.trim() || !teamName.trim()) return;
        setBusy(true);
        setError("");
        try {
            let currentOrgId = orgId;
            if (!currentOrgId) {
                if (!(await api.billing.checkLimit("client_orgs"))) return;
                const org = await api.organizations.create({ name: orgName.trim() });
                currentOrgId = org.id;
                setOrgId(org.id);
                onChange?.();
            }
            // If this fails, the org already exists — a retry only creates the team.
            const team = await api.teams.create({ name: teamName.trim(), organization_id: currentOrgId });
            setTeamId(team.id);
            onChange?.();
            setStep("people");
        } catch {
            setError(t("error"));
        } finally {
            setBusy(false);
        }
    };

    const leaveTo = (href: string, activeOrgId?: number) => {
        onLeave?.();
        onClose?.();
        if (activeOrgId) {
            // Team pages read the active org from storage; reload the layout
            // the same way the dashboard client card does.
            tokenManager.setActiveOrgId(activeOrgId);
            window.location.assign(href);
            return;
        }
        router.push(href);
    };

    // Stepper: total is fixed once the type is known; step 1 is always the type choice.
    const stepLabels =
        type === "person"
            ? [t("stepType"), t("stepPerson"), t("stepDone")]
            : [t("stepType"), t("stepOrg"), t("stepPeople"), t("stepDone")];
    const stepOrder: Step[] = type === "person" ? ["type", "person", "done"] : ["type", "org", "people", "done"];
    const currentIdx = Math.max(0, stepOrder.indexOf(step));
    const canGoBack = (step === "person" || step === "org") && !orgId;

    return (
        <div className="space-y-6">
            {type && (
                <Stepper
                    labels={stepLabels}
                    current={currentIdx}
                    progressLabel={t("stepProgress", { current: currentIdx + 1, total: stepLabels.length })}
                />
            )}

            {canGoBack && (
                <button
                    type="button"
                    onClick={() => {
                        setError("");
                        setStep("type");
                    }}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800"
                >
                    <ArrowLeft className="w-4 h-4" /> {t("back")}
                </button>
            )}

            {step === "type" && (
                <div className="space-y-3">
                    <h2 className="text-lg font-bold text-slate-800">{t("typeTitle")}</h2>
                    <TypeCard
                        icon={<UserIcon className="w-6 h-6" />}
                        tone="purple"
                        title={t("typePerson")}
                        description={t("typePersonDesc")}
                        onClick={() => chooseType("person")}
                    />
                    <TypeCard
                        icon={<Building className="w-6 h-6" />}
                        tone="blue"
                        title={t("typeOrg")}
                        description={t("typeOrgDesc")}
                        onClick={() => chooseType("org")}
                    />
                </div>
            )}

            {step === "person" && individualsOrgId && (
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-slate-800">{t("personTitle")}</h2>
                    <PersonForm
                        target={{ organizationId: individualsOrgId }}
                        submitLabel={t("addClientPerson")}
                        onChange={onChange}
                        onAdded={(p) => {
                            setPerson(p);
                            setStep("done");
                        }}
                    />
                </div>
            )}

            {step === "org" && (
                <form onSubmit={submitOrg} className="space-y-4">
                    <h2 className="text-lg font-bold text-slate-800">{t("orgTitle")}</h2>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">{t("orgNameLabel")}</label>
                        <input
                            type="text"
                            required
                            disabled={Boolean(orgId)}
                            placeholder={t("orgNamePlaceholder")}
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            className={INPUT_CLASS}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">{t("teamNameLabel")}</label>
                        <input
                            type="text"
                            required
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            className={INPUT_CLASS}
                        />
                        <p className="text-xs text-slate-400">{t("teamNameHelp")}</p>
                    </div>
                    <Button
                        type="submit"
                        disabled={busy || !orgName.trim() || !teamName.trim()}
                        className="w-full py-3 font-bold"
                    >
                        {busy ? t("adding") : t("orgSubmit")} {!busy && <ArrowRight className="w-4 h-4 ml-1" />}
                    </Button>
                </form>
            )}

            {step === "people" && teamId && (
                <div className="space-y-5">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">{t("peopleTitle", { team: teamName })}</h2>
                        <p className="text-sm text-slate-500">{t("peopleHelp")}</p>
                    </div>

                    <PdfBatchImport
                        teamId={teamId}
                        onChange={onChange}
                        onAdded={(people) => setTeamPeople((prev) => [...prev, ...people])}
                    />

                    <div className="border-t border-slate-200 pt-4">
                        <button
                            type="button"
                            onClick={() => setShowSingleForm((v) => !v)}
                            className="w-full flex items-center justify-between text-sm font-semibold text-slate-600 hover:text-slate-900"
                            aria-expanded={showSingleForm}
                        >
                            <span className="inline-flex items-center gap-1.5">
                                <Plus className="w-4 h-4" /> {t("addSingleToggle")}
                            </span>
                            <ChevronDown className={cn("w-4 h-4 transition-transform", showSingleForm && "rotate-180")} />
                        </button>
                        {showSingleForm && (
                            <div className="pt-4">
                                <PersonForm
                                    target={{ teamId }}
                                    submitLabel={t("addPerson")}
                                    onChange={onChange}
                                    onAdded={(p) => setTeamPeople((prev) => [...prev, p])}
                                />
                            </div>
                        )}
                    </div>

                    <AddedPeopleList people={teamPeople} />

                    <Button
                        type="button"
                        variant={teamPeople.length > 0 ? "default" : "outline"}
                        onClick={() => setStep("done")}
                        className="w-full py-3 font-bold"
                    >
                        {teamPeople.length > 0 ? t("finish") : t("addPeopleLater")}
                        <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                </div>
            )}

            {step === "done" && (
                <div className="space-y-5">
                    <div className="text-center space-y-2">
                        <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
                        {type === "person" && person ? (
                            <>
                                <h2 className="text-xl font-bold text-slate-900">
                                    {t("donePersonTitle", { name: person.fullName })}
                                </h2>
                                <p className="text-sm text-slate-500">
                                    {person.invitedEmail
                                        ? t("doneInviteSent", { email: person.invitedEmail })
                                        : person.hasTalents
                                          ? t("donePersonReady")
                                          : t("donePersonNoTalents")}
                                </p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-xl font-bold text-slate-900">
                                    {t("doneOrgTitle", { name: orgName })}
                                </h2>
                                <p className="text-sm text-slate-500">
                                    {t("doneOrgSubtitle", { count: teamPeople.length, team: teamName })}
                                </p>
                            </>
                        )}
                    </div>

                    {type === "person" && person && (person.publicSlug || person.publicToken) && (
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-2">
                            <p className="text-xs font-bold text-purple-900 uppercase tracking-wider">{t("linkTitle")}</p>
                            <p className="text-xs text-purple-700">{t("linkHelp")}</p>
                            <CopyProfileLinkButton
                                person={person}
                                variant="primary"
                                label={t("copyProfileLink")}
                                copiedLabel={t("linkCopied")}
                            />
                        </div>
                    )}

                    {type !== "person" && <AddedPeopleList people={teamPeople} />}

                    <div className="space-y-2">
                        {type === "person" && person ? (
                            <Button onClick={() => leaveTo(`/dashboard/users/${person.userId}`)} className="w-full py-3 font-bold">
                                {t("openProfile")} <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                        ) : (
                            teamId &&
                            orgId && (
                                <Button
                                    onClick={() => leaveTo(`/dashboard/teams/${teamId}`, orgId)}
                                    className="w-full py-3 font-bold"
                                >
                                    {t("openMatrix")} <ArrowRight className="w-4 h-4 ml-1" />
                                </Button>
                            )
                        )}
                        <Button variant="outline" onClick={resetAll} className="w-full py-3 font-semibold">
                            <Plus className="w-4 h-4 mr-1" /> {t("addAnother")}
                        </Button>
                        {onClose && (
                            <Button variant="ghost" onClick={onClose} className="w-full font-semibold text-slate-500">
                                {t("close")}
                            </Button>
                        )}
                    </div>

                    {/* What next? — the value moment after adding a company client.
                        The AI assistant is deliberately not promoted here until it is refined. */}
                    {type !== "person" && teamId && orgId && teamPeople.length > 0 && (
                        <div className="border-t border-slate-200 pt-4 space-y-2">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("nextTitle")}</p>
                            <NextStepLink
                                icon={<MonitorPlay className="w-4 h-4" />}
                                title={t("nextPresentation")}
                                description={t("nextPresentationDesc")}
                                onClick={() => leaveTo(`/dashboard/teams/${teamId}?presentation=1`, orgId)}
                            />
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {error}
                </div>
            )}
        </div>
    );
}

function NextStepLink({
    icon,
    title,
    description,
    onClick,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-primary hover:bg-blue-50/40 text-left transition group"
        >
            <span className="h-8 w-8 rounded-lg bg-blue-50 text-primary flex items-center justify-center shrink-0">
                {icon}
            </span>
            <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-slate-800">{title}</span>
                <span className="block text-xs text-slate-500">{description}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary shrink-0" />
        </button>
    );
}

function AddedPeopleList({ people }: { people: AddedPerson[] }) {
    const t = useTranslations("addClient");
    if (people.length === 0) return null;
    return (
        <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">{t("added", { count: people.length })}</p>
            <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {people.map((p) => (
                    <li
                        key={p.userId}
                        className="flex items-center justify-between gap-2 text-sm text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100"
                    >
                        <span className="flex items-center gap-2 min-w-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="truncate">{p.fullName}</span>
                        </span>
                        <CopyProfileLinkButton person={p} label={t("copyLink")} copiedLabel={t("linkCopied")} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

interface TypeCardProps {
    icon: React.ReactNode;
    tone: "purple" | "blue";
    title: string;
    description: string;
    onClick: () => void;
}

function TypeCard({ icon, tone, title, description, onClick }: TypeCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-4 p-5 rounded-2xl border border-slate-200 hover:border-primary text-left transition group",
                tone === "purple" ? "hover:bg-purple-50/40" : "hover:bg-blue-50/40"
            )}
        >
            <div
                className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                    tone === "purple" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                )}
            >
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800">{title}</div>
                <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
        </button>
    );
}
