'use client';

import { PageTitleBack } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Trash2, Key } from "lucide-react";
import { useState, useEffect } from "react";
import { getUserDetails, updateUserPassword, toggleSudo, deleteUser, SystemUser } from "../actions";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from "next/navigation";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

export default function UserDetailsPage({ params }: { params: { id: string } }) { // id is username
    const username = params.id;
    const { toast } = useToast();
    const router = useRouter();

    // Client-side fetching for simplicity or use 'use' hook if we were on cutting edge, 
    // but standard pattern here is simpler:
    // Actually, I can pass data if this was server component.
    // BUT user interaction requires state.
    // So Client Component is easier for handling "Update Password" etc.
    // We need serverId.

    const [serverId, setServerId] = useState<string | null>(null);
    const [user, setUser] = useState<SystemUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [newPassword, setNewPassword] = useState('');
    const [isUpdatingPass, setIsUpdatingPass] = useState(false);

    const [isAdmin, setIsAdmin] = useState(false);
    const [isTogglingAdmin, setIsTogglingAdmin] = useState(false);

    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const match = document.cookie.match(new RegExp('(^| )selected_server=([^;]+)'));
        const sId = match ? match[2] : null;
        setServerId(sId);

        if (sId) {
            loadUser(sId);
        } else {
            setError("No server selected");
            setIsLoading(false);
        }
    }, [username]);

    async function loadUser(sid: string) {
        setIsLoading(true);
        try {
            const res = await getUserDetails(sid, username);
            if (res.error) {
                setError(res.error);
            } else if (res.user) {
                setUser(res.user);
                // Check if admin/sudo/wheel
                const groups = res.user.groups || [];
                setIsAdmin(groups.includes('sudo') || groups.includes('wheel'));
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    }

    const handleUpdatePassword = async () => {
        if (!serverId || !user) return;
        if (!newPassword) {
            toast({ variant: 'destructive', title: 'Empty Password', description: 'Please enter a new password.' });
            return;
        }

        setIsUpdatingPass(true);
        try {
            const res = await updateUserPassword(serverId, username, newPassword);
            if (res.error) {
                toast({ variant: 'destructive', title: 'Update Failed', description: res.error });
            } else {
                toast({ title: 'Password Updated', description: 'User password has been changed successfully.' });
                setNewPassword('');
            }
        } finally {
            setIsUpdatingPass(false);
        }
    };

    const handleToggleAdmin = async (checked: boolean) => {
        if (!serverId || !user) return;

        setIsTogglingAdmin(true);
        try {
            const res = await toggleSudo(serverId, user.username, checked);
            if (res.error) {
                toast({ variant: 'destructive', title: 'Update Failed', description: res.error });
                // Revert switch visually slightly delayed or handled by re-fetch logic? 
                // We just keep local state desync if fail. 
            } else {
                setIsAdmin(checked);
                toast({ title: 'Permissions Updated', description: `User ${username} ${checked ? 'is now' : 'is no longer'} an administrator.` });
                // Reload to confirm groups
                loadUser(serverId);
            }
        } finally {
            setIsTogglingAdmin(false);
        }
    };

    const handleDelete = async () => {
        if (!serverId || !user) return;

        setIsDeleting(true);
        try {
            const res = await deleteUser(serverId, username);
            if (res.error) {
                toast({ variant: 'destructive', title: 'Delete Failed', description: res.error });
            } else {
                toast({ title: 'User Deleted', description: `User ${username} has been removed.` });
                router.push('/server/firewall/users');
                router.refresh();
            }
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <PageTitleBack title="Loading..." backHref="/server/firewall/users" />
                <Card>
                    <CardContent className="p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></CardContent>
                </Card>
            </div>
        );
    }

    if (error || !user) {
        return (
            <div className="space-y-6">
                <PageTitleBack title="Error" backHref="/server/firewall/users" />
                <Card className="border-destructive/50">
                    <CardContent className="p-8 text-center text-destructive">
                        {error || "User not found"}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageTitleBack
                title={user.username}
                description={`Manage settings for UID ${user.uid}`}
                backHref="/server/firewall/users"
            />

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>User Profile</CardTitle>
                        <CardDescription>Basic account information</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="grid gap-1">
                                <Label className="text-muted-foreground">Username</Label>
                                <div className="font-mono">{user.username}</div>
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-muted-foreground">User ID (UID)</Label>
                                <div className="font-mono">{user.uid}</div>
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-muted-foreground">Home Directory</Label>
                                <div className="font-mono break-all">{user.home}</div>
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-muted-foreground">Default Shell</Label>
                                <div className="font-mono">{user.shell}</div>
                            </div>
                            <div className="col-span-2 grid gap-1">
                                <Label className="text-muted-foreground">Groups</Label>
                                <div className="font-mono bg-muted p-2 rounded text-xs break-all">
                                    {user.groups?.join(', ') || 'None'}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Key className="h-5 w-5" />
                                Security & Permissions
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Administrator Access</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Grant sudo privileges to this user.
                                    </p>
                                </div>
                                <Switch
                                    checked={isAdmin}
                                    onCheckedChange={handleToggleAdmin}
                                    disabled={isTogglingAdmin || user.type === 'root'}
                                />
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Change Password</Label>
                                    <Input
                                        type="password"
                                        placeholder="New password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                    />
                                </div>
                                <Button size="sm" onClick={handleUpdatePassword} disabled={isUpdatingPass || !newPassword}>
                                    {isUpdatingPass && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Update Password
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-destructive/30">
                        <CardHeader>
                            <CardTitle className="text-destructive">Danger Zone</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="w-full" disabled={user.type === 'root' || isDeleting}>
                                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                        Delete User Account
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete the user <strong>{user.username}</strong> and remove their home directory ({user.home}).
                                            <br /><br />
                                            This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>
                                            Delete User
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
