"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

interface User {
    id: number;
    full_name: string;
    email: string;
    role: string;
    superpowers?: string;
    motivators?: string;
    blockers?: string;
    feedback_style?: string;
}

interface UserTalent {
    id: number;
    rank: number;
    talent: {
        id: number;
        name: string;
        domain: string;
        description: string;
    };
}

export default function UserProfilePage() {
    const params = useParams();
    const userId = parseInt(params.id as string);

    const [user, setUser] = useState<User | null>(null);
    const [talents, setTalents] = useState<UserTalent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUserData();
    }, [userId]);

    const loadUserData = async () => {
        try {
            const [userData, talentsData] = await Promise.all([
                api.users.get(userId),
                api.talents.getUserTalents(userId),
            ]);
            setUser(userData);
            setTalents(talentsData);
        } catch (err) {
            console.error("Failed to load user data", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="text-gray-600">Loading profile...</div>;
    }

    if (!user) {
        return <div className="text-red-600">User not found</div>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{user.full_name}</h1>
            <p className="text-gray-600 mb-6">{user.email}</p>

            {/* Top 5 Talents */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Top 5 Talents</h2>
                {talents.length === 0 ? (
                    <p className="text-gray-600">No talents assigned yet</p>
                ) : (
                    <div className="space-y-3">
                        {talents.map((ut) => (
                            <div key={ut.id} className="flex items-start gap-4 p-3 border border-gray-200 rounded-lg">
                                <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold">
                                    {ut.rank}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900">{ut.talent.name}</h3>
                                    <p className="text-sm text-gray-600 mt-1">{ut.talent.description}</p>
                                    <span className="inline-block mt-2 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                        {ut.talent.domain.replace("_", " ")}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* User Manual */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">User Manual</h2>
                <div className="space-y-4">
                    <div>
                        <h3 className="font-semibold text-gray-700 mb-2">💪 Superpowers</h3>
                        <p className="text-gray-600">{user.superpowers || "Not set yet"}</p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-700 mb-2">🔥 Motivators</h3>
                        <p className="text-gray-600">{user.motivators || "Not set yet"}</p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-700 mb-2">🚫 Blockers</h3>
                        <p className="text-gray-600">{user.blockers || "Not set yet"}</p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-700 mb-2">💬 Feedback Style</h3>
                        <p className="text-gray-600">{user.feedback_style || "Not set yet"}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
