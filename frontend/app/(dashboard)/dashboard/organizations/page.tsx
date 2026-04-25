"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Building2, Plus, Users, Edit3, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Org {
    id: number;
    name: string;
    address: string | null;
    nip: string | null;
    email: string | null;
    teams: { id: number; name: string; _count?: { members: number } }[];
}

export default function OrganizationsPage() {
    const [orgs, setOrgs] = useState<Org[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editOrg, setEditOrg] = useState<Org | null>(null);
    const [form, setForm] = useState({ name: '', address: '', nip: '', email: '' });
    const [loading, setLoading] = useState(true);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [error, setError] = useState("");

    const fetchOrgs = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.organizations.list(); // Assumes api.organizations.list() is defined
            setOrgs(data);
        } catch (err) {
            console.error(err);
            setError("Failed to load organizations");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

    const openAdd = () => {
        setEditOrg(null);
        setForm({ name: '', address: '', nip: '', email: '' });
        setShowModal(true);
        setError("");
    };

    const openEdit = (org: Org) => {
        setEditOrg(org);
        setForm({ name: org.name, address: org.address || '', nip: org.nip || '', email: org.email || '' });
        setShowModal(true);
        setError("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!form.name.trim()) {
            setError("Name is required");
            return;
        }

        try {
            setSubmitLoading(true);
            if (editOrg) {
                await api.organizations.update(editOrg.id, form);
            } else {
                await api.organizations.create(form);
            }
            setShowModal(false);
            fetchOrgs();
        } catch (err) {
            console.error(err);
            setError("Failed to save organization");
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this organization?')) return;
        try {
            await api.organizations.delete(id);
            fetchOrgs();
        } catch (err) {
            console.error(err);
            setError("Failed to delete organization");
        }
    };

    return (
        <div className="space-y-10">
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">Organizations</h1>
                    <p className="mt-2 text-slate-500 max-w-2xl">
                        Manage your client organizations and their teams.
                    </p>
                </div>
                
                <Dialog open={showModal} onOpenChange={(open) => {
                    setShowModal(open);
                    if (!open) setEditOrg(null);
                }}>
                    <DialogTrigger asChild>
                        <Button className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-sm hover:shadow-md active:scale-95" onClick={openAdd}>
                            <Plus className="h-4 w-4" />
                            Add Organization
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editOrg ? 'Edit Organization' : 'Add Organization'}</DialogTitle>
                            <DialogDescription>
                                {editOrg ? 'Update organization details.' : 'Create a new organization.'}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="org-name">Name *</Label>
                                <Input
                                    id="org-name"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="org-address">Address</Label>
                                <Input
                                    id="org-address"
                                    value={form.address}
                                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="org-nip">NIP</Label>
                                    <Input
                                        id="org-nip"
                                        value={form.nip}
                                        onChange={(e) => setForm({ ...form, nip: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="org-email">Email</Label>
                                    <Input
                                        id="org-email"
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    />
                                </div>
                            </div>
                            {error && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                                    {error}
                                </div>
                            )}
                            <div className="flex flex-wrap gap-3 justify-end mt-4">
                                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={submitLoading}>
                                    {submitLoading ? "Saving..." : "Save"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {loading ? (
                <div className="flex h-[400px] items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <p className="text-sm font-medium text-slate-500">Loading organizations...</p>
                    </div>
                </div>
            ) : orgs.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-16 text-center animate-fade-up">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <Building2 className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">No organizations found</h3>
                    <p className="mt-2 text-slate-500 max-w-xs mx-auto">
                        You don&apos;t have any organizations yet. Start by adding one.
                    </p>
                    <button
                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
                        onClick={openAdd}
                    >
                        <Plus className="h-4 w-4" />
                        Add First Organization
                    </button>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 animate-fade-up">
                    {orgs.map((org) => (
                        <div
                            key={org.id}
                            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors">
                                        {org.name}
                                    </h3>
                                    {org.nip && <p className="text-xs text-slate-400 font-medium mt-1">NIP: {org.nip}</p>}
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => openEdit(org)}>
                                        <Edit3 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(org.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-4 text-sm text-slate-500 space-y-1">
                                {org.address && <p>{org.address}</p>}
                                {org.email && <p>{org.email}</p>}
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium mb-3">
                                    <Users className="h-4 w-4" />
                                    <span>
                                        {org.teams?.length || 0} Teams · {org.teams?.reduce((s, t) => s + (t._count?.members || 0), 0) || 0} members
                                    </span>
                                </div>

                                {org.teams && org.teams.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {org.teams.map((team) => (
                                            <Link
                                                key={team.id}
                                                href={`/dashboard/teams/${team.id}`}
                                                className="inline-flex items-center rounded-full bg-slate-50 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors"
                                            >
                                                {team.name} <span className="ml-1 opacity-50">({team._count?.members || 0})</span>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
