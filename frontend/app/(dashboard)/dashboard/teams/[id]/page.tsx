"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import TeamGrid from "@/components/dashboard/TeamGrid";
import MatrixDashboard from "@/components/dashboard/MatrixDashboard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Trash2, ChevronDown, Check } from "lucide-react";

interface MemberResult {
    id: string | number;
    talent: string;
    domain: string;
    rank: number;
}

interface TeamMember {
    id: string | number;
    name: string;
    email?: string;
    role?: string;
    results: MemberResult[];
}

interface Talent {
    id: number;
    code: string;
    translation?: {
        name: string;
    };
    domain: string;
}

interface GhostInvitePayload {
    team_id: number;
    full_name: string;
    email: string;
    job_title: string;
    talents?: {
        talent_id: number;
        rank: number;
    }[];
}

interface Team {
    id: number;
    name: string;
    description?: string;
}

export default function TeamDetailPage() {
    const params = useParams();
    const teamId = parseInt(params.id as string);

    const router = useRouter();

    const [team, setTeam] = useState<Team | null>(null);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [allTalents, setAllTalents] = useState<Talent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showMatrix, setShowMatrix] = useState(false);
    
    // Add Member State
    const [showAddMember, setShowAddMember] = useState(false);
    const [memberForm, setMemberForm] = useState({ name: '', email: '', role: '' });
    const [selectedTalents, setSelectedTalents] = useState<number[]>([0, 0, 0, 0, 0]);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [error, setError] = useState("");

    const loadTeamData = useCallback(async () => {
        try {
            setLoading(true);
            const [teamData, matrixData, talentsData, allTeamsData] = await Promise.all([
                api.teams.get(teamId),
                api.teams.getMatrix(teamId),
                api.talents.list(),
                api.teams.list(),
            ]);
            setTeam(teamData);
            setAllTeams(allTeamsData || []);
            setMembers(matrixData.members || []);
            setAllTalents(talentsData || []);
        } catch (err) {
            console.error("Failed to load team data", err);
        } finally {
            setLoading(false);
        }
    }, [teamId]);

    useEffect(() => {
        loadTeamData();
    }, [loadTeamData]);

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        
        if (!memberForm.name || !memberForm.email) {
            setError("Imię i nazwisko oraz email są wymagane.");
            return;
        }

        const validTalents = selectedTalents.filter(t => t > 0);
        if (validTalents.length > 0 && validTalents.length !== 5) {
            setError("Wybierz dokładnie 5 talentów lub żadnego.");
            return;
        }

        try {
            setSubmitLoading(true);
            
            const payload: GhostInvitePayload = {
                team_id: teamId,
                full_name: memberForm.name,
                email: memberForm.email,
                job_title: memberForm.role,
            };

            if (validTalents.length === 5) {
                payload.talents = validTalents.map((tId, idx) => ({
                    talent_id: tId,
                    rank: idx + 1
                }));
            }

            await api.invitations.createGhostInvite(payload);
            
            setShowAddMember(false);
            setMemberForm({ name: '', email: '', role: '' });
            setSelectedTalents([0, 0, 0, 0, 0]);
            await loadTeamData();
            
        } catch (err: unknown) {
            console.error(err);
            const detail = (err as {response?: {data?: {detail?: string}}}).response?.data?.detail;
            setError(detail || "Wystąpił błąd podczas dodawania użytkownika.");
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleRemoveMember = async (userId: number) => {
        if (!confirm("Czy na pewno chcesz usunąć tego członka z zespołu?")) return;
        try {
            await api.teams.removeMember(teamId, userId);
            await loadTeamData();
        } catch (err) {
            console.error(err);
            alert("Błąd podczas usuwania członka.");
        }
    };

    const handleTalentChange = (index: number, talentId: number) => {
        const newTalents = [...selectedTalents];
        newTalents[index] = talentId;
        setSelectedTalents(newTalents);
    };

    if (loading) {
        return <div className="text-gray-600">Loading team...</div>;
    }

    if (!team) {
        return <div className="text-red-600">Team not found</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                    <div className="relative">
                        <button 
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="flex items-center gap-2 text-3xl font-bold text-slate-900 mb-2 hover:opacity-80 transition-opacity"
                        >
                            <span className="truncate max-w-[300px] sm:max-w-md">{team.name}</span>
                            <ChevronDown className={`w-6 h-6 text-slate-400 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {dropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 shadow-xl rounded-xl z-20 py-2 overflow-hidden">
                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-100 mb-1">
                                        Zmień kontekst zespołu
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {allTeams.length === 0 ? (
                                            <div className="px-4 py-3 text-sm text-slate-500 text-center">Brak innych zespołów</div>
                                        ) : (
                                            allTeams.map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => {
                                                        setDropdownOpen(false);
                                                        if (t.id !== team.id) {
                                                            router.push(`/dashboard/teams/${t.id}`);
                                                        }
                                                    }}
                                                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors ${t.id === team.id ? 'text-primary font-medium bg-blue-50/50 hover:bg-blue-50' : 'text-slate-700'}`}
                                                >
                                                    <span className="truncate">{t.name}</span>
                                                    {t.id === team.id && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    {team.description && (
                        <p className="text-slate-500">{team.description}</p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setShowMatrix(!showMatrix)}
                        className="rounded-lg font-medium"
                    >
                        {showMatrix ? "Ukryj matrycę" : "Pokaż matrycę zespołu"}
                    </Button>
                    
                    <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
                        <DialogTrigger asChild>
                            <Button className="inline-flex items-center gap-2 rounded-xl bg-primary text-white">
                                <UserPlus className="h-4 w-4" />
                                Dodaj członka
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Dodaj członka do zespołu</DialogTitle>
                                <DialogDescription>
                                    Wprowadź dane użytkownika. Zostanie mu utworzone konto (Ghost) przypisane do zespołu.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleAddMember} className="grid gap-4 mt-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Imię i nazwisko *</Label>
                                    <Input
                                        id="name"
                                        value={memberForm.name}
                                        onChange={(e) => setMemberForm({...memberForm, name: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email *</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={memberForm.email}
                                        onChange={(e) => setMemberForm({...memberForm, email: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="role">Rola / Stanowisko</Label>
                                    <Input
                                        id="role"
                                        value={memberForm.role}
                                        onChange={(e) => setMemberForm({...memberForm, role: e.target.value})}
                                    />
                                </div>

                                <div className="mt-4 border-t pt-4">
                                    <h4 className="text-sm font-semibold mb-3">Top 5 Talentów (opcjonalnie)</h4>
                                    <div className="space-y-3">
                                        {[1, 2, 3, 4, 5].map((rank, idx) => (
                                            <div key={rank} className="flex items-center gap-3">
                                                <div className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                                                    {rank}
                                                </div>
                                                <select
                                                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                    value={selectedTalents[idx]}
                                                    onChange={(e) => handleTalentChange(idx, parseInt(e.target.value))}
                                                >
                                                    <option value={0}>-- Wybierz talent --</option>
                                                    {allTalents.map(t => (
                                                        <option key={t.id} value={t.id} disabled={selectedTalents.includes(t.id) && selectedTalents[idx] !== t.id}>
                                                            {t.translation?.name || t.code}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {error && (
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                                        {error}
                                    </div>
                                )}
                                <div className="flex justify-end gap-3 mt-4 border-t pt-4">
                                    <Button type="button" variant="outline" onClick={() => setShowAddMember(false)}>
                                        Anuluj
                                    </Button>
                                    <Button type="submit" disabled={submitLoading}>
                                        {submitLoading ? "Dodawanie..." : "Zapisz"}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {showMatrix && (
                <MatrixDashboard members={members} />
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">
                        Członkowie Zespołu ({members.length})
                    </h2>
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                        Talent snapshot
                    </span>
                </div>

                {members.length === 0 ? (
                    <p className="mt-6 text-sm text-slate-500">Brak członków w zespole.</p>
                ) : (
                    <div className="mt-6">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
                            {members.map(member => (
                                <div key={member.id} className="relative group bg-slate-50 border border-slate-100 rounded-xl p-4 transition-all hover:shadow-md hover:border-slate-300">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-semibold text-slate-900">{member.name}</h3>
                                            {member.role && <p className="text-xs text-slate-500">{member.role}</p>}
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveMember(parseInt(member.id))}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-3">
                                        {member.results.slice(0,5).map((r) => (
                                            <span key={r.talent} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium truncate max-w-[120px]" title={r.talent}>
                                                {r.rank}. {r.talent}
                                            </span>
                                        ))}
                                        {member.results.length === 0 && (
                                            <span className="text-xs text-slate-400 italic">Brak wprowadzonych talentów</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <TeamGrid
                            members={members.map((member) => {
                                const topTalents = [...member.results]
                                    .sort((a, b) => a.rank - b.rank)
                                    .slice(0, 5)
                                    .map((r) => ({
                                        id: parseInt(r.id) || r.id,
                                        code: r.talent,
                                        name: r.talent,
                                        domain: r.domain
                                    }));
                                
                                return {
                                    id: parseInt(member.id) || member.id,
                                    full_name: member.name,
                                    role: member.role || '',
                                    talents: topTalents,
                                };
                            })}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
