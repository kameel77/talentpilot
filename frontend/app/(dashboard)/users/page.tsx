"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface UserSummary {
    id: number;
    full_name: string;
    email: string;
    role: string;
    is_active?: boolean;
}

export default function UsersPage() {
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const data = await api.users.list();
            setUsers(data);
        } catch (err) {
            setError("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="text-gray-600">Loading users...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Users</h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Manage the people behind each talent profile and translate strengths into daily actions.
                    </p>
                </div>
                <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
                    Invite User
                </button>
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                    {error}
                </div>
            )}

            {users.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
                    <p className="text-gray-600">
                        No users yet. Invite team members to start mapping talents to business competencies.
                    </p>
                    <button className="mt-6 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
                        Invite Your First User
                    </button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {users.map((user) => (
                        <Link
                            key={user.id}
                            href={`/dashboard/users/${user.id}`}
                            className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        {user.full_name}
                                    </h3>
                                    <p className="text-sm text-gray-500">{user.email}</p>
                                </div>
                                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">
                                    {user.role}
                                </span>
                            </div>
                            <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                                <span>
                                    Status: {user.is_active === false ? "Inactive" : "Active"}
                                </span>
                                <span className="text-indigo-600 group-hover:text-indigo-700">View profile</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
