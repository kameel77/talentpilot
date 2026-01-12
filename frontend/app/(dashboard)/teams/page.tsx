"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Team {
    id: number;
    name: string;
    description?: string;
    manager_id?: number;
}

export default function TeamsPage() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        loadTeams();
    }, []);

    const loadTeams = async () => {
        try {
            const data = await api.teams.list();
            setTeams(data);
        } catch (err: any) {
            setError("Failed to load teams");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="text-gray-600">Loading teams...</div>;
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    Add Team
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                    {error}
                </div>
            )}

            {teams.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                    <p className="text-gray-600 mb-4">No teams yet</p>
                    <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                        Create Your First Team
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {teams.map((team) => (
                        <Link
                            key={team.id}
                            href={`/dashboard/teams/${team.id}`}
                            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 hover:border-indigo-300"
                        >
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                {team.name}
                            </h3>
                            {team.description && (
                                <p className="text-sm text-gray-600">{team.description}</p>
                            )}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
