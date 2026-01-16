"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import DomainChart from "@/components/dashboard/DomainChart";
import TalentBadge from "@/components/dashboard/TalentBadge";
import UserManualCard from "@/components/dashboard/UserManualCard";

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

        loadUserData();
    }, [userId]);

    if (loading) {
        return <div className="text-gray-600">Loading profile...</div>;
    }

    if (!user) {
        return <div className="text-red-600">User not found</div>;
    }

    return (
        <div className="space-y-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                    {user.full_name}
                </h1>
                <p className="text-slate-500">{user.email}</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-slate-900">
                            Top 5 Talents
                        </h2>
                        <span className="text-xs uppercase tracking-wide text-slate-400">
                            CliftonStrengths
                        </span>
                    </div>
                    {talents.length === 0 ? (
                        <p className="mt-6 text-sm text-slate-500">
                            No talents assigned yet.
                        </p>
                    ) : (
                        <div className="mt-6 grid gap-4">
                            {talents.map((ut) => (
                                <div
                                    key={ut.id}
                                    className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                                            {ut.rank}
                                        </div>
                                        <div className="space-y-2">
                                            <TalentBadge
                                                name={ut.talent.name}
                                                domain={ut.talent.domain}
                                                description={ut.talent.description}
                                            />
                                            <p className="text-sm text-slate-600">
                                                {ut.talent.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DomainChart talents={talents.map((ut) => ut.talent)} />
            </div>

            <UserManualCard
                data={{
                    superpowers: user.superpowers,
                    motivators: user.motivators,
                    blockers: user.blockers,
                    feedback_style: user.feedback_style,
                }}
            />
        </div>
    );
}
