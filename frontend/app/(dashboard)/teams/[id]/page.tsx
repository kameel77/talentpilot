"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

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
        loadTeamData();
    }, [teamId]);

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

    if (loading) {
        return <div className="text-gray-600">Loading team...</div>;
    }

    if (!team) {
        return <div className="text-red-600">Team not found</div>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{team.name}</h1>
            {team.description && (
                <p className="text-gray-600 mb-6">{team.description}</p>
            )}

            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Team Members ({members.length})
                </h2>

                {members.length === 0 ? (
                    <p className="text-gray-600">No members yet</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {members.map((member) => (
                            <div
                                key={member.id}
                                className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors"
                            >
                                <h3 className="font-semibold text-gray-900">{member.full_name}</h3>
                                <p className="text-sm text-gray-600">{member.email}</p>
                                <span className="inline-block mt-2 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                    {member.role}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
