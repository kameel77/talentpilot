"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, UserRound } from "lucide-react";
import { api, tokenManager, User, Team } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface ClientOrg {
    id: number;
    name: string;
}

export default function IndividualClientsTab() {
    const t = useTranslations("clients");
    const me = tokenManager.getUser();

    const [individuals, setIndividuals] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [clientOrgs, setClientOrgs] = useState<ClientOrg[]>([]);

    // Pin modal state
    const [pinTarget, setPinTarget] = useState<User | null>(null);
    const [selectedOrgId, setSelectedOrgId] = useState<number | "new" | "">("");
    const [newOrgName, setNewOrgName] = useState("");
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<number | "">("");
    const [pinning, setPinning] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (!me) return;
        setLoading(true);
        try {
            const [users, orgs] = await Promise.all([
                api.users.list(undefined, me.organization_id),
                api.auth.getMyOrganizations(),
            ]);
            setIndividuals((users as User[]).filter((u) => u.id !== me.id && u.role === "user"));
            setClientOrgs(orgs);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { load(); }, [load]);

    // Load teams whenever an existing org is selected in the modal
    useEffect(() => {
        setSelectedTeamId("");
        if (typeof selectedOrgId === "number") {
            api.teams.list(selectedOrgId).then((ts) =>
                setTeams(ts.filter((team) => team.organization_id === selectedOrgId))
            );
        } else {
            setTeams([]);
        }
    }, [selectedOrgId]);

    const openPinModal = (u: User) => {
        setPinTarget(u);
        setSelectedOrgId("");
        setNewOrgName("");
        setSelectedTeamId("");
        setError("");
    };

    const closePinModal = () => {
        setPinTarget(null);
        setSelectedOrgId("");
        setNewOrgName("");
        setSelectedTeamId("");
        setError("");
    };

    const handlePin = async () => {
        if (!pinTarget) return;
        setPinning(true);
        setError("");
        try {
            let orgId: number;
            if (selectedOrgId === "new") {
                const org = await api.organizations.create({ name: newOrgName });
                setClientOrgs((prev) => [...prev, { id: org.id, name: org.name }]);
                setSelectedOrgId(org.id);
                setNewOrgName("");
                orgId = org.id;
            } else if (typeof selectedOrgId === "number") {
                orgId = selectedOrgId;
            } else {
                setPinning(false);
                return;
            }
            await api.invitations.moveOrganization(pinTarget.id, {
                organization_id: orgId,
                team_id: typeof selectedTeamId === "number" ? selectedTeamId : undefined,
            });
            closePinModal();
            await load();
        } catch {
            setError(t("error"));
        } finally {
            setPinning(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
        );
    }

    if (individuals.length === 0) {
        return <p className="text-slate-500 text-sm py-8 text-center">{t("empty")}</p>;
    }

    return (
        <div className="space-y-3">
            {individuals.map((u) => (
                <div
                    key={u.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                            <UserRound className="h-5 w-5 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{u.full_name}</p>
                            <p className="text-xs text-slate-500 truncate">{u.email}</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openPinModal(u)}>
                        {t("pin")}
                    </Button>
                </div>
            ))}

            {pinTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-xl">
                        <h3 className="text-lg font-bold text-slate-900">
                            {t("pinTitle", { name: pinTarget.full_name })}
                        </h3>
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-slate-700">{t("pinExisting")}</label>
                            <select
                                value={selectedOrgId}
                                onChange={(e) =>
                                    setSelectedOrgId(e.target.value === "new" ? "new" : e.target.value ? Number(e.target.value) : "")
                                }
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                            >
                                <option value="">—</option>
                                {clientOrgs.map((o) => (
                                    <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                                <option value="new">{t("pinNew")}</option>
                            </select>
                        </div>
                        {selectedOrgId === "new" && (
                            <input
                                type="text" placeholder={t("pinNewName")}
                                value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                            />
                        )}
                        {typeof selectedOrgId === "number" && teams.length > 0 && (
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-slate-700">{t("pinTeam")}</label>
                                <select
                                    value={selectedTeamId}
                                    onChange={(e) => setSelectedTeamId(e.target.value ? Number(e.target.value) : "")}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                                >
                                    <option value="">{t("pinNoTeam")}</option>
                                    {teams.map((tm) => (
                                        <option key={tm.id} value={tm.id}>{tm.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {error && <p className="text-sm text-rose-600">{error}</p>}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={closePinModal}>{t("cancel")}</Button>
                            <Button
                                onClick={handlePin}
                                disabled={pinning || selectedOrgId === "" || (selectedOrgId === "new" && !newOrgName)}
                            >
                                {pinning ? t("pinning") : t("pinConfirm")}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
