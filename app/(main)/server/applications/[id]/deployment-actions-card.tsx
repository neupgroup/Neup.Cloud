// This file has been removed as it is not UI-only or action logic.
'use client';

import { Card } from "@/components/ui/card";
import { useToast } from '@/core/hooks/use-toast';
import { cn } from "@/core/utils";
import { FileText, UploadCloud, Key, Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useState } from "react";
import { deployConfiguration } from "@/services/server/applications/service";

interface DeploymentActionsCardProps {
    applicationId: string;
    onOpenEnvironments?: () => void;
    onOpenFiles?: () => void;
}

export function DeploymentActionsCard({ applicationId, onOpenEnvironments, onOpenFiles }: DeploymentActionsCardProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [isDeploying, setIsDeploying] = useState(false);

    const openInline = (view: 'environments' | 'files') => {
        const route = view === 'environments' ? 'environment' : 'files';
        router.push(`/server/applications/${applicationId}/${route}`);
    };

    const handleDeploy = async () => {
        setIsDeploying(true);
        try {
            await deployConfiguration(applicationId);
            toast({
                title: "Configuration Deployed",
                description: "Environment variables and config files have been updated on the server.",
            });
        } catch (error: any) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Deployment Failed",
                description: error.message || "Failed to deploy configuration.",
            });
        } finally {
            setIsDeploying(false);
        }
    };

    const ActionRow = ({
        icon: Icon,
        title,
        description,
        onClick,
        isLoading = false,
        isLast = false
    }: {
        icon: any,
        title: string,
        description: string,
        onClick?: () => void,
        isLoading?: boolean,
        isLast?: boolean
    }) => {
        const Content = () => (
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between mb-0 h-8">
                    <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground transition-colors group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                        {title}
                    </h3>

                    <div className="flex items-center gap-1">
                        <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                        </div>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                    {description}
                </p>
            </div>
        );

        const className = cn(
            "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer",
            !isLast && "border-b border-border",
            isLoading && "opacity-50 pointer-events-none"
        );

        return (
            <div onClick={onClick} className={className}>
                <Content />
            </div>
        );
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-lg font-medium flex items-center gap-2">
                <UploadCloud className="h-5 w-5" />
                Deployment & Configuration
            </h3>

            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                <ActionRow
                    icon={UploadCloud}
                    title="Deploy Configuration"
                    description="Deploy environment variables and config files to the server"
                    onClick={handleDeploy}
                    isLoading={isDeploying}
                />

                <ActionRow
                    icon={Key}
                    title="Environment Variables"
                    description="Manage environment variables and secrets for this application"
                    onClick={onOpenEnvironments ?? (() => openInline('environments'))}
                />

                <ActionRow
                    icon={FileText}
                    title="Custom Files"
                    description="Manage file overrides that deploy with your configuration"
                    onClick={onOpenFiles ?? (() => openInline('files'))}
                    isLast
                />
            </Card>
        </div>
    );
}
