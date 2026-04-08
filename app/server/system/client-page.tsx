'use client';

import Link from 'next/link';
import { PageTitle } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HardDrive, ArrowUpCircle, Package, Repeat2, ShieldCheck } from 'lucide-react';
import { useServerName } from '@/hooks/use-server-name';

export default function SystemPage() {
    const serverName = useServerName();

    return (
        <div className="space-y-8">
            <PageTitle
                title="System Management"
                description="Manage core server maintenance areas from one place, including storage, updates, packages, requirements, and swap settings."
                serverName={serverName}
            />

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <HardDrive className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Storage</CardTitle>
                        </div>
                        <CardDescription>
                            Monitor disk usage and review storage allocation on the selected server.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Includes disk usage insights and capacity visibility for key system areas.
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button asChild className="w-full">
                            <Link href="/server/system/storage">Open Storage</Link>
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <ArrowUpCircle className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Updates</CardTitle>
                        </div>
                        <CardDescription>
                            Check available system updates and manage package upgrade operations.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Review upgradable packages and open detailed update information per package.
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button asChild className="w-full">
                            <Link href="/server/system/updates">Open Updates</Link>
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Packages</CardTitle>
                        </div>
                        <CardDescription>
                            Browse installed software, inspect versions, and install new packages.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Access package details, install workflows, and package management actions.
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button asChild className="w-full">
                            <Link href="/server/system/packages">Open Packages</Link>
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Repeat2 className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Swapper</CardTitle>
                        </div>
                        <CardDescription>
                            Define the shared swap size used by remote command execution.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        The configured swap value is stored on the server and reused across command runs.
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button asChild className="w-full">
                            <Link href="/server/system/swapper">Open Swapper</Link>
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Requirement</CardTitle>
                        </div>
                        <CardDescription>
                            Review system requirements and validate server readiness for key dependencies.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Open requirement checks and dependency pages for server setup and compatibility.
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button asChild className="w-full">
                            <Link href="/server/system/requirement">Open Requirement</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
