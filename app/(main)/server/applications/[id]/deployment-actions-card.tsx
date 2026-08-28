// This file has been removed as it is not UI-only or action logic.
'use client';

import { Card } from "#/components/ui/card";
import { useToast } from '#/core/hooks/useToast';
import { useSelectedServerId } from '@/hooks/use-selected-server';
import { withSelectedServerQuery } from '@/helpers/navigation';
import { cn } from "#/core/utils";
import Icon from "#/components/ui/icon";
import { FileText, UploadCloud, Key } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from "react";
import { deployConfiguration } from "@/services/server/applications/service";

interface DeploymentActionsCardProps {
    applicationId: string;
    onOpenEnvironments?: () => void;
    onOpenFiles?: () => void;
}

export function DeploymentActionsCard({ applicationId, onOpenEnvironments, onOpenFiles }: DeploymentActionsCardProps) {
    const { toast } = useToast();
    const selectedServerId = useSelectedServerId();
    const router = useRouter();
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploymentState, setDeploymentState] = useState<'idle' | 'uploading' | 'complete'>('idle');

    const openInline = (view: 'environments' | 'files') => {
        const route = view === 'environments' ? 'environment' : 'files';
        router.push(withSelectedServerQuery(`/server/applications/${applicationId}/${route}`, selectedServerId));
    };

    const handleDeploy = async () => {
        setIsDeploying(true);
        setDeploymentState('uploading');
        const deploymentToast = toast({
            name: `application-deployment-${applicationId}`,
            convey: 'info',
            icon: <Icon type="animated" from="Upload" size={24} />,
            dismissesOn: null,
            title: "Deploying Configuration",
            description: "Environment variables and config files are being updated on the server.",
        });

        try {
            await deployConfiguration(applicationId, selectedServerId);
            setDeploymentState('complete');
            deploymentToast.update({
                convey: 'success',
                icon: <Icon type="animated" from="Upload" to="TickMark" size={24} />,
                actions: [
                    ['Open app', 'success', withSelectedServerQuery(`/server/applications/${applicationId}`, selectedServerId)],
                    ['Dismiss', 'none', 'dismiss'],
                ],
                dismissesOn: 10,
                title: "Deployed Configuration",
                description: "Environment variables and config files have been updated on the server.",
            });
        } catch (error: any) {
            console.error(error);
            setDeploymentState('idle');
            deploymentToast.update({
                convey: 'dangerous',
                icon: undefined,
                actions: [
                    ['Open app', 'danger', withSelectedServerQuery(`/server/applications/${applicationId}`, selectedServerId)],
                    ['Dismiss', 'none', 'dismiss'],
                ],
                dismissesOn: 10,
                variant: "destructive",
                title: "Couldn't Deploy",
                description: error.message || "Failed to deploy configuration.",
            });
        } finally {
            setIsDeploying(false);
        }
    };

    const ActionRow = ({
        icon,
        title,
        description,
        onClick,
        isLoading = false,
        isLast = false
    }: {
        icon: ReactNode,
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
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-[8px] p-1.5 text-muted-foreground transition-colors group-hover:text-foreground"
                        >
                            {isLoading ? <Icon type="animated" from="Upload" size={24} /> : icon}
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
                    icon={deploymentState === 'complete' ? (
                        <Icon
                            key="deployment-complete"
                            type="animated"
                            from="Upload"
                            to="TickMark"
                            size={24}
                        />
                    ) : (
                        <UploadCloud className="h-4 w-4" />
                    )}
                    title="Deploy Configuration"
                    description="Deploy environment variables and config files to the server"
                    onClick={handleDeploy}
                    isLoading={isDeploying}
                />

                <ActionRow
                    icon={<Key className="h-4 w-4" />}
                    title="Environment Variables"
                    description="Manage environment variables and secrets for this application"
                    onClick={onOpenEnvironments ?? (() => openInline('environments'))}
                />

                <ActionRow
                    icon={<FileText className="h-4 w-4" />}
                    title="Custom Files"
                    description="Manage file overrides that deploy with your configuration"
                    onClick={onOpenFiles ?? (() => openInline('files'))}
                    isLast
                />
            </Card>
        </div>
    );
}
