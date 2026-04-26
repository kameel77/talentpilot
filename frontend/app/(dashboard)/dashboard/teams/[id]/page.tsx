"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

import MatrixDashboard from "@/components/dashboard/MatrixDashboard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Trash2, ChevronDown, Check, Crown, Edit2, Upload, Search, FileText, X, Loader2 } from "lucide-react";

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
    is_leader?: boolean;
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

const getDomainColor = (domain: string) => {
    const domainMap: Record<string, string> = {
        'Executing': 'bg-purple-100 text-purple-700 border-purple-200',
        'Wykonywanie': 'bg-purple-100 text-purple-700 border-purple-200',
        'Influencing': 'bg-yellow-100 text-yellow-700 border-yellow-200',
        'Wpływanie': 'bg-yellow-100 text-yellow-700 border-yellow-200',
        'Relationship Building': 'bg-blue-100 text-blue-700 border-blue-200',
        'Budowanie relacji': 'bg-blue-100 text-blue-700 border-blue-200',
        'Strategic Thinking': 'bg-red-100 text-red-700 border-red-200',
        'Myślenie strategiczne': 'bg-red-100 text-red-700 border-red-200',
    };
    return domainMap[domain] || 'bg-slate-100 text-slate-700 border-slate-200';
};

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
    
    // Edit Member State
    const [editingMember, setEditingMember] = useState<{ id: string | number, name: string, email: string, role: string } | null>(null);
    const [membersSearch, setMembersSearch] = useState('');
    
    // PDF Import State
    const pdfImportRef = useRef<HTMLInputElement>(null);
    const triggerPdfImport = () => pdfImportRef.current?.click();
    type PdfImportStatus = 'pending' | 'processing' | 'success' | 'error';
    type PdfImportItem = { fileName: string; name: string | null; status: PdfImportStatus; error?: string };
    const [pdfImportItems, setPdfImportItems] = useState<PdfImportItem[]>([]);
    const [showPdfImport, setShowPdfImport] = useState(false);

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

    const handleEditMemberSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMember) return;
        try {
            await api.users.update(editingMember.id as number, {
                full_name: editingMember.name,
                email: editingMember.email,
                job_title: editingMember.role,
            });
            setEditingMember(null);
            await loadTeamData();
        } catch (err) {
            console.error(err);
            alert("Błąd podczas edycji członka.");
        }
    };

    const toggleLeader = async (member: TeamMember) => {
        try {
            const newManagerId = member.is_leader ? null : member.id;
            await api.teams.update(teamId, { manager_id: newManagerId as number | null });
            await loadTeamData();
        } catch (err) {
            console.error(err);
            alert("Błąd podczas zmiany lidera.");
        }
    };

    const onPdfImportSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (files.length === 0) return;

        const items: PdfImportItem[] = files.map(f => ({ fileName: f.name, name: null, status: 'pending' }));
        setPdfImportItems(items);
        setShowPdfImport(true);

        for (let i = 0; i < files.length; i++) {
            setPdfImportItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'processing' } : it));
            try {
                const data = await api.invitations.parsePdf(files[i]);
                const name = `${data.person?.first_name || ''} ${data.person?.last_name || ''}`.trim() || files[i].name.replace('.pdf', '');
                
                const mappedTalents = (data.talents || []).map((t: { talent: string; rank: number }) => {
                    const found = allTalents.find(at => at.code === t.talent || at.translation?.name === t.talent);
                    return { talent_id: found?.id || 0, rank: t.rank };
                }).filter((t: { talent_id: number; rank: number }) => t.talent_id > 0);

                const payload: GhostInvitePayload = {
                    team_id: teamId,
                    full_name: name,
                    email: `user_${Date.now()}_${i}@example.com`,
                    job_title: '',
                };

                if (mappedTalents.length > 0) {
                    payload.talents = mappedTalents;
                }

                await api.invitations.createGhostInvite(payload);
                setPdfImportItems(prev => prev.map((it, idx) => idx === i ? { ...it, name, status: 'success' } : it));
            } catch (err: unknown) {
                const errorObj = err as { response?: { data?: { detail?: string } }, message?: string };
                const msg = errorObj.response?.data?.detail || errorObj.message || 'Error';
                setPdfImportItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'error', error: msg } : it));
            }
        }
        await loadTeamData();
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

    const filteredMembers = members.filter(m => 
        m.name.toLowerCase().includes(membersSearch.toLowerCase()) || 
        (m.role || '').toLowerCase().includes(membersSearch.toLowerCase())
    );

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
                    
                    <Button 
                        variant="secondary"
                        onClick={triggerPdfImport}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                        <Upload className="h-4 w-4" />
                        Importuj PDF
                    </Button>
                    <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
                        <DialogTrigger asChild>
                            <Button className="inline-flex items-center gap-2 rounded-xl bg-primary text-white shadow-sm">
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

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-6">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">
                            Członkowie Zespołu <span className="text-sm font-normal text-slate-500 ml-2">({members.length})</span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Zarządzaj osobami w tym zespole i ich profilami talentowymi.</p>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Szukaj członka..."
                                className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-shadow bg-slate-50 focus:bg-white"
                                value={membersSearch}
                                onChange={(e) => setMembersSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {members.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <UserPlus className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-1">Brak członków</h3>
                        <p className="text-slate-500 max-w-sm mx-auto">
                            Ten zespół jest obecnie pusty. Dodaj członków ręcznie lub zaimportuj ich z raportów Gallup.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200">
                                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Osoba</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rola / Stanowisko</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Top 5 Talentów</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Akcje</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredMembers.map((member) => {
                                    const top5 = [...member.results]
                                        .sort((a, b) => a.rank - b.rank)
                                        .slice(0, 5);

                                    return (
                                        <tr key={member.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium shadow-sm shrink-0">
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-slate-900 flex items-center gap-2">
                                                            {member.name}
                                                            {member.is_leader && (
                                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-600" title="Lider zespołu">
                                                                    <Crown className="w-3 h-3" />
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-sm text-slate-500">{member.email || "Brak adresu email"}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="text-sm text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md inline-block">
                                                    {member.role || 'Brak stanowiska'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex flex-wrap gap-1.5 max-w-md">
                                                    {top5.length > 0 ? top5.map((t) => (
                                                        <span 
                                                            key={t.talent} 
                                                            className={`text-[11px] px-2.5 py-1 rounded-full border font-medium truncate max-w-[140px] ${getDomainColor(t.domain)}`} 
                                                            title={t.talent}
                                                        >
                                                            {t.rank}. {t.talent}
                                                        </span>
                                                    )) : (
                                                        <span className="text-sm text-slate-400 italic">Brak wprowadzonych talentów</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => toggleLeader(member)}
                                                        className={`p-2 rounded-lg transition-colors ${member.is_leader ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                                        title={member.is_leader ? "Odbierz status lidera" : "Ustaw jako lidera"}
                                                    >
                                                        <Crown className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => setEditingMember({ id: member.id, name: member.name, email: member.email || '', role: member.role || '' })}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Edytuj dane"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleRemoveMember(parseInt(member.id as string))}
                                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                        title="Usuń członka z zespołu"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredMembers.length === 0 && members.length > 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-slate-500">
                                            Nie znaleziono osób pasujących do wyszukiwania.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Edit Member Dialog */}
            <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edytuj członka zespołu</DialogTitle>
                    </DialogHeader>
                    {editingMember && (
                        <form onSubmit={handleEditMemberSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Imię i nazwisko</Label>
                                <Input value={editingMember.name} onChange={e => setEditingMember({...editingMember, name: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input type="email" value={editingMember.email} onChange={e => setEditingMember({...editingMember, email: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Stanowisko</Label>
                                <Input value={editingMember.role} onChange={e => setEditingMember({...editingMember, role: e.target.value})} />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <Button type="button" variant="outline" onClick={() => setEditingMember(null)}>Anuluj</Button>
                                <Button type="submit">Zapisz zmiany</Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Hidden File Input for PDF Import */}
            <input
                type="file"
                multiple
                accept="application/pdf"
                className="hidden"
                ref={pdfImportRef}
                onChange={onPdfImportSelect}
            />

            {/* PDF Import Progress Dialog */}
            <Dialog open={showPdfImport} onOpenChange={setShowPdfImport}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Importowanie raportów Gallup</DialogTitle>
                        <DialogDescription>
                            Przetwarzanie wybranych plików PDF...
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-3">
                        {pdfImportItems.map((item, idx) => (
                            <div key={idx} className={`p-3 rounded-xl border flex items-center gap-3 ${
                                item.status === 'success' ? 'bg-emerald-50 border-emerald-100' :
                                item.status === 'error' ? 'bg-rose-50 border-rose-100' :
                                item.status === 'processing' ? 'bg-blue-50 border-blue-100' :
                                'bg-slate-50 border-slate-100'
                            }`}>
                                <div className="shrink-0">
                                    {item.status === 'success' ? <Check className="w-5 h-5 text-emerald-500" /> :
                                     item.status === 'error' ? <X className="w-5 h-5 text-rose-500" /> :
                                     item.status === 'processing' ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" /> :
                                     <FileText className="w-5 h-5 text-slate-400" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-slate-900 truncate">
                                        {item.name || item.fileName}
                                    </p>
                                    <p className={`text-xs ${
                                        item.status === 'error' ? 'text-rose-600' : 'text-slate-500'
                                    }`}>
                                        {item.status === 'success' ? 'Zaimportowano pomyślnie' :
                                         item.status === 'error' ? (item.error || 'Błąd przetwarzania') :
                                         item.status === 'processing' ? 'Analizowanie raportu...' :
                                         'Oczekuje w kolejce...'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 flex justify-end">
                        <Button 
                            onClick={() => setShowPdfImport(false)}
                            disabled={pdfImportItems.some(i => i.status === 'processing' || i.status === 'pending')}
                        >
                            Zamknij
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
