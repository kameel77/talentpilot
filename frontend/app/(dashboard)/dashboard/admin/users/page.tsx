"use client";

import { useEffect, useState } from "react";
import { api, User, Organization } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Shield, Building, X, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal state
    const [selectedCoach, setSelectedCoach] = useState<User | null>(null);
    const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
    const [savingAccess, setSavingAccess] = useState<number | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [usersData, orgsData] = await Promise.all([
                api.admin.getUsers(),
                api.admin.getOrganizations()
            ]);
            setUsers(usersData);
            setOrganizations(orgsData);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: number, newRole: 'admin' | 'manager' | 'coach' | 'user') => {
        try {
            const updatedUser = await api.admin.updateUserRole(userId, newRole);
            setUsers(users.map(u => u.id === userId ? { ...u, role: updatedUser.role, organizations_access: updatedUser.organizations_access } : u));
        } catch (error) {
            console.error("Failed to update role:", error);
            alert("Błąd podczas zmiany roli");
        }
    };

    const openOrgModal = (coach: User) => {
        setSelectedCoach(coach);
        setIsOrgModalOpen(true);
    };

    const handleToggleOrgAccess = async (orgId: number, hasAccess: boolean) => {
        if (!selectedCoach) return;
        
        try {
            setSavingAccess(orgId);
            const newAccesses = await api.admin.toggleOrganizationAccess(selectedCoach.id, orgId, hasAccess);
            
            // Update selected coach
            const updatedCoach = { ...selectedCoach, organizations_access: newAccesses };
            setSelectedCoach(updatedCoach);
            
            // Update in the main users array
            setUsers(users.map(u => u.id === selectedCoach.id ? updatedCoach : u));
            
        } catch (error) {
            console.error("Failed to toggle access:", error);
            alert("Wystąpił błąd podczas odbierania/nadawania dostępu.");
        } finally {
            setSavingAccess(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Pobieranie listy użytkowników...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight flex items-center gap-3">
                    <Users className="h-8 w-8 text-blue-600" />
                    Użytkownicy i dostępy
                </h1>
                <p className="mt-1 text-slate-500 font-medium">
                    Zarządzaj kontami, rolami i dostępami do organizacji trenerskich.
                </p>
            </div>

            <Card className="border-slate-200/60 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-lg flex items-center gap-2">
                        Lista zalogowanych w systemie
                    </CardTitle>
                    <CardDescription>
                        Użyj rozwijanej listy, aby awansować lub obniżać uprawnienia. Tylko dla ról "Coach" dostępne jest przyznawanie wglądu do innych organizacji.
                    </CardDescription>
                </CardHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Użytkownik</th>
                                <th className="px-6 py-4 font-semibold">Organizacja Domyślna</th>
                                <th className="px-6 py-4 font-semibold">Rola w systemie</th>
                                <th className="px-6 py-4 font-semibold text-right">Akcje</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map((user) => {
                                const orgName = organizations.find(o => o.id === user.organization_id)?.name || "Brak Danych";
                                const isCoach = user.role === 'coach';
                                
                                return (
                                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-900">{user.full_name}</div>
                                            <div className="text-slate-500 text-xs">{user.email}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
                                                <Building className="h-3.5 w-3.5" />
                                                {orgName}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <select 
                                                className="bg-white border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user.id, e.target.value as any)}
                                            >
                                                <option value="user">User</option>
                                                <option value="manager">Manager</option>
                                                <option value="coach">Coach</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {isCoach && (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => openOrgModal(user)}
                                                    className="font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                                                >
                                                    <Shield className="h-4 w-4 mr-2" />
                                                    Dostępy
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Coach Org Access Modal */}
            <Dialog open={isOrgModalOpen} onOpenChange={setIsOrgModalOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Shield className="h-5 w-5 text-indigo-600" />
                            Dostępy Trenera
                        </DialogTitle>
                        <DialogDescription>
                            Zarządzaj dostępem dla <strong>{selectedCoach?.full_name}</strong> do innych organizacji. 
                            Po przyznaniu wglądu, trener będzie mógł się przełączać pomiędzy przypisanymi organizacjami z menu profilu na pulpicie.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4 mt-2 max-h-[60vh] overflow-y-auto">
                        <div className="space-y-3">
                            {organizations.map(org => {
                                // Skip their own organization, they inherently have access based on user table, 
                                // although it's good practice to explicitely manage it. Let's just list all of them.
                                const isHomeOrg = org.id === selectedCoach?.organization_id;
                                const hasAccess = selectedCoach?.organizations_access?.includes(org.id) || false;
                                const isSaving = savingAccess === org.id;

                                return (
                                    <div key={org.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-900 flex items-center gap-2">
                                                {org.name}
                                                {isHomeOrg && (
                                                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                                                        Domyślna
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        <div>
                                            {!isHomeOrg ? (
                                                <button
                                                    onClick={() => handleToggleOrgAccess(org.id, !hasAccess)}
                                                    disabled={savingAccess !== null}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                        hasAccess ? "bg-emerald-500" : "bg-slate-300"
                                                    } ${savingAccess !== null ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                                >
                                                    {isSaving ? (
                                                        <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-white z-10" />
                                                    ) : null}
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                                            hasAccess ? "translate-x-6" : "translate-x-1"
                                                        } ${isSaving ? "opacity-0" : ""}`}
                                                    />
                                                </button>
                                            ) : (
                                                <span className="text-xs font-semibold text-slate-400 mr-2">
                                                    Wbudowany
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
