"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { tokenManager } from "@/lib/api";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check authentication
        const token = tokenManager.getToken();
        if (!token) {
            router.push("/login");
            return;
        }

        const currentUser = tokenManager.getUser();
        setUser(currentUser);
        setLoading(false);
    }, [router]);

    const handleLogout = () => {
        tokenManager.removeToken();
        router.push("/login");
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-gray-600">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 p-6">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        TalentPilot
                    </h1>
                </div>

                <nav className="space-y-2">
                    <Link
                        href="/dashboard"
                        className="block px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        Dashboard
                    </Link>
                    <Link
                        href="/dashboard/teams"
                        className="block px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        Teams
                    </Link>
                    <Link
                        href="/dashboard/users"
                        className="block px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        Users
                    </Link>
                </nav>
            </aside>

            {/* Main content */}
            <div className="ml-64">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-800">Welcome back!</h2>
                            {user && (
                                <p className="text-sm text-gray-600">{user.full_name}</p>
                            )}
                        </div>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <main className="p-8">{children}</main>
            </div>
        </div>
    );
}
