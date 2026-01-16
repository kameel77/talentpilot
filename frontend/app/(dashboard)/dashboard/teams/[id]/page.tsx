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
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">{team.name}</h1>
                {team.description && (
                    <p className="text-slate-500">{team.description}</p>
                )}
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
