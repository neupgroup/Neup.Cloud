
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, ShieldCheck, Key, User, Database } from 'lucide-react';
import { createDatabaseUser } from '@/actions/database';
import { Checkbox } from "@/components/ui/checkbox";

interface UserCreateFormProps {
    serverId: string;
    engine: 'mariadb' | 'postgres';
    dbName: string;
    onSuccess?: () => void;
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

export function UserCreateForm({ serverId, engine, dbName, onSuccess }: UserCreateFormProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(PERMISSION_PRESETS.full);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // For now, we'll map to the existing 'full' or 'read' system
            // In a real implementation, you'd update the backend to support granular permissions
            const hasWritePerms = selectedPermissions.some(p => ['INSERT', 'UPDATE', 'DELETE'].includes(p));
            const permissions: 'full' | 'read' = hasWritePerms ? 'full' : 'read';

            const result = await createDatabaseUser(serverId, engine, dbName, username, password, permissions);
            if (result.success) {
                toast({
                    title: 'User created',
                    description: result.message,
                });
                setUsername('');
                setPassword('');
                onSuccess?.();
                router.push(`/server/database/${engine}-${dbName}/users`);
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Creation Failed',
                    description: result.message,
                });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Failed to create database user.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="border-2 border-primary/5">
            <CardHeader className="bg-muted/10">
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <UserPlus className="h-5 w-5 text-primary" />
                    Add Database User
                </CardTitle>
                <CardDescription>Grant a new user specific permissions to this database</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="app_user"
                                className="pl-10 h-11"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                            <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="pl-10 h-11"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>Permissions</Label>
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
                                        id={permission}
                                        checked={selectedPermissions.includes(permission)}
                                        onCheckedChange={() => togglePermission(permission)}
                                        className="mt-0.5"
                                    />
                                    <div className="flex-1">
                                        <label
                                            htmlFor={permission}
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

                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 flex items-start gap-2 text-xs text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <div>
                            <p className="font-semibold text-foreground mb-1">Security Best Practice</p>
                            <p>Grant only the minimum permissions required for the application. You can always add more permissions later.</p>
                        </div>
                    </div>

                    <Button type="submit" className="w-full h-11 shadow-lg shadow-primary/10" disabled={isLoading || selectedPermissions.length === 0}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating User...
                            </>
                        ) : (
                            'Create User'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
