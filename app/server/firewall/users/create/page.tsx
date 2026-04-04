'use client';

import { PageTitleBack } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2 } from "lucide-react";
import { useState } from "react";
import { createUser } from "../actions"; // Import from ../actions since we are in create subfolder
import { useToast } from '@/hooks/use-toast';
import { useRouter } from "next/navigation";

export default function CreateUserPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        groups: 'sudo' // default to sudo for convenience? or empty. Let's say empty or common ones.
    });

    // Helper to get serverId from cookies in client is messy, and our actions handle it? 
    // Wait, actions need serverId passed or they can grab it if they use 'cookies()'.
    // BUT `createUser` signature is `createUser(serverId, data)`.
    // It requires serverId as arg.
    // So we must fetch it. 

    // Quick serverId fetch from document.cookies for Client Component
    const getServerId = () => {
        const match = document.cookie.match(new RegExp('(^| )selected_server=([^;]+)'));
        return match ? match[2] : null;
    };


    const handleSubmit = async () => {
        if (!formData.username) {
            toast({ variant: 'destructive', title: 'Username required', description: 'Please enter a username.' });
            return;
        }

        const serverId = getServerId();
        if (!serverId) {
            toast({ variant: 'destructive', title: 'No Server', description: 'Please select a server first.' });
            return;
        }

        // Basic validation
        if (!/^[a-z_][a-z0-9_-]*$/.test(formData.username)) {
            toast({ variant: 'destructive', title: 'Invalid username', description: 'Username must start with a letter/underscore and contain only lowercase letters, numbers, dashes, or underscores.' });
            return;
        }

        setIsLoading(true);
        try {
            const result = await createUser(serverId, formData);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Failed to create user', description: result.error });
            } else {
                toast({ title: 'Success', description: `User ${formData.username} created successfully.` });
                router.push('/server/firewall/users');
                router.refresh();
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageTitleBack
                title="Create User"
                description="Add a new user account to this instance."
                backHref="/server/firewall/users"
            />

            <div className="max-w-2xl">
                <Card>
                    <CardHeader>
                        <CardTitle>Account Details</CardTitle>
                        <CardDescription>Configure the new user's credentials and permissions.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                placeholder="jdoe"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                                disabled={isLoading}
                            />
                            <p className="text-xs text-muted-foreground">
                                Must start with a letter and contain only lowercase letters, numbers, or underscores.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                disabled={isLoading}
                            />
                            <p className="text-xs text-muted-foreground">
                                Optional. If left blank, the user will be created without a password (SSH key access only).
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="groups">Data Groups</Label>
                            <Input
                                id="groups"
                                placeholder="sudo, docker"
                                value={formData.groups}
                                onChange={(e) => setFormData({ ...formData, groups: e.target.value })}
                                disabled={isLoading}
                            />
                            <p className="text-xs text-muted-foreground">
                                Comma separated list of groups. Add 'sudo' for admin rights.
                            </p>
                        </div>
                        <Button className="w-full sm:w-auto" onClick={handleSubmit} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                            Create User
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
