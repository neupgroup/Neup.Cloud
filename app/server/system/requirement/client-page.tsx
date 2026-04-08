'use client';

import { PageTitle } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { requirements } from '@/requirements/list';
import * as Icons from 'lucide-react';
import { useServerName } from '@/hooks/use-server-name';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const Icon = ({ name, className }: { name: string, className?: string }) => {
    // @ts-ignore
    const LucideIcon = Icons[name];
    if (!LucideIcon) return <Icons.HelpCircle className={className} />;
    return <LucideIcon className={className} />;
};

interface RequirementItem {
    name: string;
    details: string;
    status: 'met' | 'not_met' | 'warning';
}

const mockRequirements: RequirementItem[] = [
    { name: 'OS Version', details: 'Ubuntu 22.04 LTS or newer', status: 'met' },
    { name: 'Memory', details: 'Minimum 4GB RAM required', status: 'met' },
    { name: 'Disk Space', details: 'At least 20GB free space', status: 'met' },
    { name: 'Network Ports', details: 'Ports 80, 443 must be open', status: 'met' },
    { name: 'User Privileges', details: 'Root access or sudo privileges', status: 'met' },
    { name: 'Virtualization', details: 'KVM support enabled', status: 'warning' },
];

export default function RequirementsPage() {
    const serverName = useServerName();
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <Button asChild variant="ghost" size="sm" className="w-fit -ml-2 text-muted-foreground hover:text-foreground">
                <Link href="/server/system">
                    <ArrowLeft className="mr-1 h-4 w-4" /> Back to System
                </Link>
            </Button>

            <PageTitle
                title="System Requirements"
                description="Manage core system dependencies and configurations"
                serverName={serverName}
            />

            <div className="grid gap-6 md:grid-cols-3">
                {requirements.map((req) => (
                    <Link key={req.id} href={`/server/system/requirement/${req.id}`} className="group">
                        <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="p-2 rounded-lg bg-muted group-hover:bg-background transition-colors text-blue-500">
                                        <Icon name={req.icon} className="h-6 w-6" />
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                                <CardTitle className="mt-4">{req.title}</CardTitle>
                                <CardDescription>{req.description}</CardDescription>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>

            <section className="space-y-4 pt-4">
                <h3 className="text-lg font-medium">Core System Checks</h3>
                <Card className="rounded-lg border bg-card text-card-foreground shadow-sm">
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {mockRequirements.map((req) => (
                                <div key={req.name} className="flex items-center justify-between p-4">
                                    <div className="space-y-1">
                                        <p className="font-medium leading-none">{req.name}</p>
                                        <p className="text-sm text-muted-foreground">{req.details}</p>
                                    </div>
                                    <div className={cn(
                                        "px-2 py-1 rounded text-xs font-medium capitalize",
                                        req.status === 'met' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                            req.status === 'warning' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                                                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                    )}>
                                        {req.status.replace('_', ' ')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
