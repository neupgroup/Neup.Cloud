
'use client';

import { performGitOperation } from "@/app/server/applications/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { Download, ExternalLink, GitBranch, GitPullRequest, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import Link from 'next/link';
import { useState } from "react";

interface GitHubSectionProps {
    application: any;
}

export function GitHubSection({ application }: GitHubSectionProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState<string | null>(null);

    if (!application.repository) return null;

    const handleAction = async (operation: 'clone' | 'pull' | 'pull-force' | 'reset-main') => {
        setLoading(operation);
        try {
            await performGitOperation(application.id, operation);
            toast({
                title: "Action Dispatched",
                description: `Git operation '${operation}' has been started.`,
            });
        } catch (error: any) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Action Failed",
                description: error.message || "Could not perform git operation.",
            });
        } finally {
            setLoading(null);
        }
    };

    const ActionRow = ({
        icon: Icon,
        title,
        description,
        onClick,
        href,
        isLoading,
        isDestructive = false,
        isLast = false
    }: {
        icon: any,
        title: string,
        description: string,
        onClick?: () => void,
        href?: string,
        isLoading?: boolean,
        isDestructive?: boolean,
        isLast?: boolean
    }) => {
        const Content = () => (
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between mb-0 h-8">
                    <h3 className={cn(
                        "font-semibold leading-none tracking-tight truncate pr-4 transition-colors group-hover:underline decoration-muted-foreground/30 underline-offset-4",
                        isDestructive ? "text-destructive" : "text-foreground"
                    )}>
                        {title}
                    </h3>

                    {/* Action Icon / Status */}
                    <div className="flex items-center gap-1">
                        <div className={cn(
                            "h-8 w-8 flex items-center justify-center transition-colors",
                            isDestructive ? "text-destructive/70 group-hover:text-destructive" : "text-muted-foreground group-hover:text-foreground"
                        )}>
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                        </div>
                    </div>
                </div>
                <p className={cn(
                    "text-sm line-clamp-2",
                    isDestructive ? "text-destructive/70" : "text-muted-foreground"
                )}>
                    {description}
                </p>
            </div>
        );

        const className = cn(
            "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer",
            !isLast && "border-b border-border",
            isLoading && "opacity-50 pointer-events-none"
        );

        if (href) {
            return (
                <Link href={href} target="_blank" rel="noreferrer" className={className}>
                    <Content />
                </Link>
            );
        }

        return (
            <div onClick={onClick} className={className}>
                <Content />
            </div>
        );
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-lg font-medium flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Repository & Source
            </h3>

            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                {/* 1. Open Repository */}
                <ActionRow
                    icon={ExternalLink}
                    title="Open Repository"
                    description={`View source code at ${application.repository}`}
                    href={application.repository}
                />

                {/* 2. Clone */}
                <ActionRow
                    icon={Download}
                    title="Clone Repository"
                    description="Clone a fresh copy of the repository code to the server"
                    onClick={() => handleAction('clone')}
                    isLoading={loading === 'clone'}
                />

                {/* 3. Pull */}
                <ActionRow
                    icon={GitPullRequest}
                    title="Pull Changes"
                    description="Update the local repository with the latest changes from remote"
                    onClick={() => handleAction('pull')}
                    isLoading={loading === 'pull'}
                />

                {/* 4. Force Pull */}
                <ActionRow
                    icon={RefreshCw}
                    title="Force Pull"
                    description="Reset local changes and force update from remote (Destructive)"
                    onClick={() => handleAction('pull-force')}
                    isLoading={loading === 'pull-force'}
                    isDestructive
                    isLast
                />
            </Card>
        </div>
    );
}
