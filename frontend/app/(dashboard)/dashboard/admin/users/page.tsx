"use client";

import { useEffect, useState } from "react";
import { api, User, Organization } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Users, Shield, Building, Save, UserPlus, Building2, Pencil, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type NewUserRole = 'admin' | 'manager' | 'coach' | 'user';

interface NewUserForm {
    email: string;
    password: string;
    full_name: string;
    role: NewUserRole;
    organization_id: string;
}

const EMPTY_NEW_USER: NewUserForm = {
    email: "",
    password: "",
    full_name: "",
    role: "user",
    organization_id: "",
};

interface NewOrgForm {
    name: string;
    street: string;
    postal_code: string;
    city: string;
    tax_id: string;
}

const EMPTY_NEW_ORG: NewOrgForm = {
    name: "",
    street: "",
    postal_code: "",
    city: "",
    tax_id: "",
};

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal state
    const [selectedCoach, setSelectedCoach] = useState<User | null>(null);
    const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
    const [savingAccess, setSavingAccess] = useState<number | null>(null);

    // Create-user modal state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newUser, setNewUser] = useState<NewUserForm>(EMPTY_NEW_USER);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Create-organization modal state
    const [isOrgCreateModalOpen, setIsOrgCreateModalOpen] = useState(false);
    const [newOrg, setNewOrg] = useState<NewOrgForm>(EMPTY_NEW_ORG);
    const [creatingOrg, setCreatingOrg] = useState(false);
    const [orgCreateError, setOrgCreateError] = useState<string | null>(null);

    // Edit-user modal state
    const [editUser, setEditUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState({ full_name: "", email: "", job_title: "" });
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // Delete confirmation state
    const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
    const [deleting, setDeleting] = useState(false);

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

    const openCreateModal = () => {
        setNewUser(EMPTY_NEW_USER);
        setCreateError(null);
        setIsCreateModalOpen(true);
    };

    const openCreateOrgModal = () => {
        setNewOrg(EMPTY_NEW_ORG);
        setOrgCreateError(null);
        setIsOrgCreateModalOpen(true);
    };

    const handleCreateOrganization = async (e: React.FormEvent) => {
        e.preventDefault();
        setOrgCreateError(null);

        try {
            setCreatingOrg(true);
            const created = await api.organizations.create({
                name: newOrg.name.trim(),
                street: newOrg.street.trim() || undefined,
                postal_code: newOrg.postal_code.trim() || undefined,
                city: newOrg.city.trim() || undefined,
                tax_id: newOrg.tax_id.trim() || undefined,
            });
            setOrganizations([...organizations, created].sort((a, b) => a.name.localeCompare(b.name)));
            setIsOrgCreateModalOpen(false);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { detail?: string | string[] } } };
            const detail = err?.response?.data?.detail;
            setOrgCreateError(typeof detail === 'string' ? detail : "Nie udało się utworzyć organizacji.");
        } finally {
            setCreatingOrg(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError(null);

        const orgOptional = newUser.role === 'admin' || newUser.role === 'coach';
        if (!orgOptional && !newUser.organization_id) {
            setCreateError("Wybierz organizację domyślną.");
            return;
        }

        try {
            setCreating(true);
            const created = await api.admin.createUser({
                email: newUser.email.trim(),
                password: newUser.password,
                full_name: newUser.full_name.trim(),
                role: newUser.role,
                organization_id: newUser.organization_id ? Number(newUser.organization_id) : null,
            });
            setUsers([created, ...users]);
            setIsCreateModalOpen(false);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { detail?: string | string[] } } };
            const detail = err?.response?.data?.detail;
            setCreateError(typeof detail === 'string' ? detail : "Nie udało się utworzyć użytkownika.");
        } finally {
            setCreating(false);
        }
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

    const openEditModal = (user: User) => {
        setEditUser(user);
        setEditForm({ full_name: user.full_name, email: user.email, job_title: user.job_title || "" });
        setEditError(null);
    };

    const handleEditUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editUser) return;
        setEditError(null);
        try {
            setEditSaving(true);
            const updated = await api.admin.updateUser(editUser.id, {
                full_name: editForm.full_name.trim(),
                email: editForm.email.trim(),
                job_title: editForm.job_title.trim() || undefined,
            });
            setUsers(users.map(u => u.id === editUser.id ? { ...u, ...updated } : u));
            setEditUser(null);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { detail?: string } } };
            setEditError(err?.response?.data?.detail || "Nie udało się zaktualizować użytkownika.");
        } finally {
            setEditSaving(false);
        }
    };

    const handleArchiveUser = async (user: User) => {
        try {
            const updated = await api.admin.updateUser(user.id, { is_active: !user.is_active });
            setUsers(users.map(u => u.id === user.id ? { ...u, ...updated } : u));
        } catch {
            alert("Błąd podczas zmiany statusu użytkownika.");
        }
    };

    const handleDeleteUser = async () => {
        if (!deleteTarget) return;
        try {
            setDeleting(true);
            await api.admin.deleteUser(deleteTarget.id);
            setUsers(users.map(u => u.id === deleteTarget.id ? null : u).filter(Boolean) as User[]);
            setDeleteTarget(null);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { detail?: string } } };
            alert(err?.response?.data?.detail || "Nie udało się usunąć użytkownika.");
        } finally {
            setDeleting(false);
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
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight flex items-center gap-3">
                        <Users className="h-8 w-8 text-blue-600" />
                        Użytkownicy i dostępy
                    </h1>
                    <p className="mt-1 text-slate-500 font-medium">
                        Zarządzaj kontami, rolami i dostępami do organizacji trenerskich.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button variant="outline" onClick={openCreateOrgModal}>
                        <Building2 className="h-4 w-4 mr-2" />
                        Dodaj organizację
                    </Button>
                    <Button onClick={openCreateModal}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Dodaj użytkownika
                    </Button>
                </div>
            </div>

            <Card className="border-slate-200/60 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-lg flex items-center gap-2">
                        Lista zalogowanych w systemie
                    </CardTitle>
                    <CardDescription>
                        Użyj rozwijanej listy, aby awansować lub obniżać uprawnienia. Tylko dla ról &quot;Coach&quot; dostępne jest przyznawanie wglądu do innych organizacji.
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
                                                onChange={(e) => handleRoleChange(user.id, e.target.value as 'admin' | 'manager' | 'coach' | 'user')}
                                            >
                                                <option value="user">User</option>
                                                <option value="manager">Manager</option>
                                                <option value="coach">Coach</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEditModal(user)}
                                                    className="text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                                    title="Edytuj"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleArchiveUser(user)}
                                                    className={user.is_active
                                                        ? "text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                                                        : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                                    }
                                                    title={user.is_active ? "Archiwizuj" : "Aktywuj"}
                                                >
                                                    {user.is_active ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setDeleteTarget(user)}
                                                    className="text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                                                    title="Usuń"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
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
                                            </div>
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

            {/* Create User Modal */}
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <UserPlus className="h-5 w-5 text-blue-600" />
                            Dodaj użytkownika
                        </DialogTitle>
                        <DialogDescription>
                            Utwórz nowe konto. Dla ról <strong>Admin</strong> i <strong>Coach</strong> pole „Organizacja domyślna” jest opcjonalne.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateUser} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="new-user-name">Imię i nazwisko</Label>
                            <Input
                                id="new-user-name"
                                value={newUser.full_name}
                                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                                required
                                minLength={1}
                                maxLength={255}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-user-email">Email</Label>
                            <Input
                                id="new-user-email"
                                type="email"
                                value={newUser.email}
                                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                required
                                autoComplete="off"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-user-password">Hasło</Label>
                            <Input
                                id="new-user-password"
                                type="password"
                                value={newUser.password}
                                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                required
                                minLength={8}
                                maxLength={72}
                                autoComplete="new-password"
                            />
                            <p className="text-xs text-slate-500">Minimum 8 znaków.</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-user-role">Rola w systemie</Label>
                            <select
                                id="new-user-role"
                                className="bg-white border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                value={newUser.role}
                                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as NewUserRole })}
                            >
                                <option value="user">User</option>
                                <option value="manager">Manager</option>
                                <option value="coach">Coach</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-user-org">
                                Organizacja domyślna
                                {(newUser.role === 'admin' || newUser.role === 'coach') && (
                                    <span className="ml-2 text-xs font-normal text-slate-500">
                                        (opcjonalna dla {newUser.role === 'admin' ? 'admina' : 'coacha'})
                                    </span>
                                )}
                            </Label>
                            <select
                                id="new-user-org"
                                className="bg-white border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                value={newUser.organization_id}
                                onChange={(e) => setNewUser({ ...newUser, organization_id: e.target.value })}
                                required={newUser.role !== 'admin' && newUser.role !== 'coach'}
                            >
                                <option value="">— wybierz —</option>
                                {organizations.map((org) => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                            </select>
                        </div>

                        {createError && (
                            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                                {createError}
                            </div>
                        )}

                        <DialogFooter className="pt-2">
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={creating}>Anuluj</Button>
                            </DialogClose>
                            <Button type="submit" disabled={creating}>
                                {creating ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Tworzenie…</>
                                ) : (
                                    <><Save className="h-4 w-4 mr-2" />Utwórz użytkownika</>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Create Organization Modal */}
            <Dialog open={isOrgCreateModalOpen} onOpenChange={setIsOrgCreateModalOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Building2 className="h-5 w-5 text-blue-600" />
                            Dodaj organizację
                        </DialogTitle>
                        <DialogDescription>
                            Utwórz nową organizację. Pola adresowe i NIP są opcjonalne.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateOrganization} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="new-org-name">Nazwa organizacji</Label>
                            <Input
                                id="new-org-name"
                                value={newOrg.name}
                                onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                                required
                                minLength={1}
                                maxLength={255}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-org-street">Ulica i numer</Label>
                            <Input
                                id="new-org-street"
                                value={newOrg.street}
                                onChange={(e) => setNewOrg({ ...newOrg, street: e.target.value })}
                                maxLength={255}
                                placeholder="ul. Przykładowa 1"
                            />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="new-org-postal">Kod pocztowy</Label>
                                <Input
                                    id="new-org-postal"
                                    value={newOrg.postal_code}
                                    onChange={(e) => setNewOrg({ ...newOrg, postal_code: e.target.value })}
                                    maxLength={20}
                                    placeholder="00-000"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-org-city">Miasto</Label>
                                <Input
                                    id="new-org-city"
                                    value={newOrg.city}
                                    onChange={(e) => setNewOrg({ ...newOrg, city: e.target.value })}
                                    maxLength={120}
                                    placeholder="Warszawa"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-org-nip">NIP</Label>
                            <Input
                                id="new-org-nip"
                                value={newOrg.tax_id}
                                onChange={(e) => setNewOrg({ ...newOrg, tax_id: e.target.value })}
                                maxLength={32}
                                placeholder="0000000000"
                            />
                        </div>

                        {orgCreateError && (
                            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                                {orgCreateError}
                            </div>
                        )}

                        <DialogFooter className="pt-2">
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={creatingOrg}>Anuluj</Button>
                            </DialogClose>
                            <Button type="submit" disabled={creatingOrg}>
                                {creatingOrg ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Tworzenie…</>
                                ) : (
                                    <><Save className="h-4 w-4 mr-2" />Utwórz organizację</>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit User Modal */}
            <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Pencil className="h-5 w-5 text-blue-600" />
                            Edytuj użytkownika
                        </DialogTitle>
                        <DialogDescription>
                            Zmień dane profilu <strong>{editUser?.full_name}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleEditUser} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit-user-name">Imię i nazwisko</Label>
                            <Input
                                id="edit-user-name"
                                value={editForm.full_name}
                                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-user-email">Email</Label>
                            <Input
                                id="edit-user-email"
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-user-job">Stanowisko</Label>
                            <Input
                                id="edit-user-job"
                                value={editForm.job_title}
                                onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })}
                                placeholder="np. Product Manager"
                            />
                        </div>

                        {editError && (
                            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                                {editError}
                            </div>
                        )}

                        <DialogFooter className="pt-2">
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={editSaving}>Anuluj</Button>
                            </DialogClose>
                            <Button type="submit" disabled={editSaving}>
                                {editSaving ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Zapisuję…</>
                                ) : (
                                    <><Save className="h-4 w-4 mr-2" />Zapisz zmiany</>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete User Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Usunąć użytkownika?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Czy na pewno chcesz trwale usunąć konto <strong>{deleteTarget?.full_name}</strong> ({deleteTarget?.email})?
                            Tej operacji nie można cofnąć.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Anuluj</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteUser}
                            disabled={deleting}
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            {deleting ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Usuwanie…</>
                            ) : (
                                <><Trash2 className="h-4 w-4 mr-2" />Usuń na stałe</>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}
