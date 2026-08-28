"use client";

import React from 'react';
import { PageTitle } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#/components/ui/card';
import { Label } from '#/components/ui/label';
import { Input } from '#/components/ui/input';
import { Button } from '#/components/ui/button';
import { Separator } from '#/components/ui/separator';
import { Switch } from '#/components/ui/switch';

import {
    User,
    Mail,
    Bell,
    Moon,
    Shield,
    Smartphone
} from 'lucide-react';

export default function SettingsPage() {
    return (
        <div className="grid gap-6 animate-in fade-in duration-500 pb-10">
            <PageTitle
                title="Settings"
                description="Manage your account preferences and application settings."
            />

            <div className="grid gap-6">



                {/* Profile Section */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <User className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Profile</CardTitle>
                        </div>
                        <CardDescription>
                            Your personal information and how we contact you.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="display-name" className="text-base font-semibold">Display Name</Label>
                            <Input id="display-name" defaultValue="Neup Cloud User" />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="email" className="text-base font-semibold">Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input id="email" className="pl-9" defaultValue="user@neup.cloud" disabled />
                            </div>
                            <p className="text-[0.8rem] text-muted-foreground">
                                Contact support to change your email address.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4 flex justify-end">
                        <Button>Save Profile</Button>
                    </CardFooter>
                </Card>

                {/* Appearance & Notifications */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Preferences</CardTitle>
                        </div>
                        <CardDescription>
                            Manage application behavior and appearance.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6">

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base font-semibold">Dark Mode</Label>
                                <p className="text-sm text-muted-foreground">
                                    Enable dark mode for the application.
                                </p>
                            </div>
                            <Switch />
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base font-semibold">Email Notifications</Label>
                                <p className="text-sm text-muted-foreground">
                                    Receive emails about your server status.
                                </p>
                            </div>
                            <Switch defaultChecked />
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base font-semibold">Two-Factor Authentication</Label>
                                <p className="text-sm text-muted-foreground">
                                    Add an extra layer of security to your account.
                                </p>
                            </div>
                            <Button type="outlined" size="sm">Enable</Button>
                        </div>

                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
