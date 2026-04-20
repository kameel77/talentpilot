"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import TeamGrid from "@/components/dashboard/TeamGrid";

interface Team {
    id: number;
    name: string;
    description?: string;
}

interface User {
    id: number;
    full_name: string;
    email: string;
    role: string;
}

export default function TeamDetailPage() {
    const params = useParams();
    const teamId = parseInt(params.id as string);

    const [team, setTeam] = useState<Team | null>(null);
    const [members, setMembers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [generatingMatrix, setGeneratingMatrix] = useState(false);

    const handleGenerateMatrix = async () => {
        try {
            setGeneratingMatrix(true);
            const response = await api.teams.generateMatrix(teamId);
            if (response.url) {
                window.open(response.url, '_blank');
            }
        } catch (err) {
            console.error("Failed to generate matrix", err);
            alert("Nie udało się wygenerować matrycy. Sprawdź konfigurację integracji.");
        } finally {
            setGeneratingMatrix(false);
        }
    };

    useEffect(() => {
        const loadTeamData = async () => {
            try {
                const [teamData, usersData] = await Promise.all([
                    api.teams.get(teamId),
                    api.users.list(teamId),
                ]);
                setTeam(teamData);
                setMembers(usersData);
            } catch (err) {
                console.error("Failed to load team data", err);
            } finally {
                setLoading(false);
            }
        };

        loadTeamData();
    }, [teamId]);

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
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">{team.name}</h1>
                    {team.description && (
                        <p className="text-slate-500">{team.description}</p>
                    )}
                </div>
                <button
                    onClick={handleGenerateMatrix}
                    disabled={generatingMatrix}
                    className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
                >
                    {generatingMatrix ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generowanie...
                        </>
                    ) : (
                        "Pokaż matrycę zespołu"
                    )}
                </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">
                        Team Members ({members.length})
                    </h2>
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                        Talent snapshot
                    </span>
                </div>

                {members.length === 0 ? (
                    <p className="mt-6 text-sm text-slate-500">No members yet</p>
                ) : (
                    <div className="mt-6">
                        <TeamGrid
                            members={members.map((member) => ({
                                id: member.id,
                                full_name: member.full_name,
                                role: member.role,
                                talents: [],
                            }))}
                        />
                        <p className="mt-4 text-xs text-slate-400">
                            Assign top talents to reveal the team grid.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
