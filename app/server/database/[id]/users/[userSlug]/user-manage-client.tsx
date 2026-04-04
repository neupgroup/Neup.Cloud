
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, ShieldCheck, Trash2, Key, ChevronLeft, Loader2, Save, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { updateDatabaseUserPermissions, deleteDatabaseUser, updateDatabaseUserPassword } from "@/actions/database";
import Link from 'next/link';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface UserManageClientProps {
    serverId: string;
    engine: 'mariadb' | 'postgres';
    dbName: string;
    username: string;
    host: string;
}

type Permission = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP' | 'ALTER' | 'INDEX';

const PERMISSION_PRESETS = {
    full: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'INDEX'] as Permission[],
    read: ['SELECT'] as Permission[],
    readWrite: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as Permission[],
    developer: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'INDEX'] as Permission[],
};

const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
    SELECT: 'Read data from tables',
    INSERT: 'Add new records to tables',
    UPDATE: 'Modify existing records',
    DELETE: 'Remove records from tables',
    CREATE: 'Create new tables and databases',
    DROP: 'Delete tables and databases',
    ALTER: 'Modify table structures',
    INDEX: 'Create and manage indexes',
};

export function UserManageClient({ serverId, engine, dbName, username, host }: UserManageClientProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(PERMISSION_PRESETS.full);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handlePresetClick = (preset: keyof typeof PERMISSION_PRESETS) => {
        setSelectedPermissions(PERMISSION_PRESETS[preset]);
    };

    const togglePermission = (permission: Permission) => {
        setSelectedPermissions(prev =>
            prev.includes(permission)
                ? prev.filter(p => p !== permission)
                : [...prev, permission]
        );
    };

    const handleUpdatePermissions = async () => {
        setIsLoading(true);
        try {
            // Map to existing full/read system
            const hasWritePerms = selectedPermissions.some(p => ['INSERT', 'UPDATE', 'DELETE'].includes(p));
            const permissions: 'full' | 'read' = hasWritePerms ? 'full' : 'read';

            const res = await updateDatabaseUserPermissions(serverId, engine, dbName, username, host, permissions);
            if (res.success) {
                toast({ title: 'Permissions updated', description: res.message });
            } else {
                toast({ variant: 'destructive', title: 'Update failed', description: res.message });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast({ variant: 'destructive', title: 'Error', description: 'Passwords do not match' });
            return;
        }

        if (newPassword.length < 8) {
            toast({ variant: 'destructive', title: 'Error', description: 'Password must be at least 8 characters' });
            return;
        }

        setIsLoading(true);
        try {
            const res = await updateDatabaseUserPassword(serverId, engine, username, newPassword, host);
            if (res.success) {
                toast({ title: 'Password changed', description: res.message });
                setNewPassword('');
                setConfirmPassword('');
            } else {
                toast({ variant: 'destructive', title: 'Update failed', description: res.message });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Delete user ${username}? This action cannot be undone.`)) return;
        setIsLoading(true);
        try {
            const res = await deleteDatabaseUser(serverId, engine, dbName, username, host);
            if (res.success) {
                toast({ title: 'User deleted', description: res.message });
                router.push(`/server/database/${engine}-${dbName}/users`);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: res.message });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="space-y-1">
                <Button variant="ghost" className="pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground" asChild>
                    <Link href={`/server/database/${engine}-${dbName}/users`}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back to Users
                    </Link>
                </Button>
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight">{username}</h1>
                    <Badge variant="secondary" className="uppercase">{engine}</Badge>
                </div>
                <p className="text-muted-foreground">Managing access to <span className="text-foreground font-medium">{dbName}</span></p>
            </div>

            <div className="max-w-2xl space-y-6">
                {/* Connection Info */}
                <Card className="border-2 border-primary/5">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Key className="h-5 w-5 text-primary" />
                            Connection Information
                        </CardTitle>
                        <CardDescription>Use these credentials to connect to the database</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-muted-foreground font-medium uppercase text-[10px]">Username</p>
                                <p className="font-mono bg-muted p-2 rounded text-sm">{username}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-muted-foreground font-medium uppercase text-[10px]">Allowed Host</p>
                                <p className="font-mono bg-muted p-2 rounded text-sm">{host}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Change Password */}
                <Card className="border-2 border-primary/5">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Lock className="h-5 w-5 text-primary" />
                            Change Password
                        </CardTitle>
                        <CardDescription>Update the authentication password for this user</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    className="h-11"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    className="h-11"
                                    required
                                />
                            </div>
                            <Button type="submit" className="gap-2" disabled={isLoading}>
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Update Password
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Permissions */}
                <Card className="border-2 border-primary/5">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            Database Permissions
                        </CardTitle>
                        <CardDescription>Control what this user can do in the database</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Permission Presets</Label>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePresetClick('read')}
                                        className="h-7 text-xs"
                                    >
                                        Read Only
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePresetClick('readWrite')}
                                        className="h-7 text-xs"
                                    >
                                        Read/Write
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePresetClick('developer')}
                                        className="h-7 text-xs"
                                    >
                                        Developer
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePresetClick('full')}
                                        className="h-7 text-xs"
                                    >
                                        Full Access
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 p-4 bg-muted/30 rounded-lg border">
                                {(Object.keys(PERMISSION_DESCRIPTIONS) as Permission[]).map((permission) => (
                                    <div key={permission} className="flex items-start space-x-3">
                                        <Checkbox
                                            id={`manage-${permission}`}
                                            checked={selectedPermissions.includes(permission)}
                                            onCheckedChange={() => togglePermission(permission)}
                                            className="mt-0.5"
                                        />
                                        <div className="flex-1">
                                            <label
                                                htmlFor={`manage-${permission}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                            >
                                                {permission}
                                            </label>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {PERMISSION_DESCRIPTIONS[permission]}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Button onClick={handleUpdatePermissions} className="gap-2 shadow-lg shadow-primary/10" disabled={isLoading || selectedPermissions.length === 0}>
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save Permission Changes
                        </Button>
                    </CardContent>
                </Card>

                {/* Danger Zone */}
                <Card className="border-2 border-destructive/20 bg-destructive/5">
                    <CardHeader className="bg-destructive/10">
                        <CardTitle className="text-lg text-destructive flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            Danger Zone
                        </CardTitle>
                        <CardDescription>Irreversible and destructive actions</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Deleting this user will immediately revoke all access to this database. Any applications using these credentials will fail to connect.
                        </p>
                        <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Delete User Account
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
