'use client';

import { useParams } from 'next/navigation';
import { requirements } from '@/requirements/list';
import { PageTitleBack } from '@/components/page-header';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import Cookies from 'universal-cookie';
import { checkRequirementStep, installRequirementStep, uninstallRequirementStep } from '../runner';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, XCircle, Trash2, AlertTriangle } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { useServerName } from '@/hooks/use-server-name';

const Icon = ({ name, className }: { name: string, className?: string }) => {
    // @ts-ignore
    const LucideIcon = Icons[name];
    if (!LucideIcon) return <Icons.HelpCircle className={className} />;
    return <LucideIcon className={className} />;
};

function RequirementSkeleton() {
    return (
        <div className="space-y-8 max-w-5xl animate-in fade-in duration-500 pb-10">
            <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <div className="space-y-1.5">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-6 w-full max-w-2xl" />
                </div>
            </div>

            <div className="space-y-4">
                <Skeleton className="h-7 w-40" />
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-4 w-full max-w-md" />
                            </div>
                        </div>
                    ))}
                    <div className="p-4 border-t bg-muted/10">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="space-y-2 flex-1 w-full">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-4 w-64" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function RequirementDetailPage() {
    const params = useParams();
    const { toast } = useToast();
    const id = params.id as string;

    const config = requirements.find(r => r.id === id);
    const serverName = useServerName();

    const [stepStatus, setStepStatus] = useState<Record<number, 'pending' | 'checking' | 'completed' | 'failed'>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [isUninstalling, setIsUninstalling] = useState(false);

    const cookies = new Cookies(null, { path: '/' });
    const serverId = cookies.get('selected_server');

    useEffect(() => {
        if (config && serverId) {
            checkAllSteps();
        } else {
            setIsLoading(false);
        }
    }, [config, serverId]);

    const checkAllSteps = async () => {
        if (!config || !serverId) return;

        setStepStatus({}); // Reset status

        for (let i = 0; i < config.steps.length; i++) {
            setStepStatus(prev => ({ ...prev, [i]: 'checking' }));

            const res = await checkRequirementStep(serverId, config.steps[i].checkCommand);

            if (res.completed) {
                setStepStatus(prev => ({ ...prev, [i]: 'completed' }));
            } else {
                setStepStatus(prev => ({ ...prev, [i]: 'pending' }));
                break; // Stop checking further steps if current one fails
            }
        }

        setIsLoading(false);
    };

    const handleInstall = async () => {
        if (!config || !serverId) return;
        setIsInstalling(true);

        for (let i = 0; i < config.steps.length; i++) {
            // Check if step is already completed
            setStepStatus(prev => ({ ...prev, [i]: 'checking' }));
            const preCheckRes = await checkRequirementStep(serverId, config.steps[i].checkCommand);

            if (preCheckRes.completed) {
                setStepStatus(prev => ({ ...prev, [i]: 'completed' }));
                continue;
            }

            // Not completed, proceed to install
            const installRes = await installRequirementStep(serverId, config.steps[i].installCommand);
            if (installRes.error) {
                toast({ variant: 'destructive', title: `Step ${i + 1} Failed`, description: installRes.error });
                setStepStatus(prev => ({ ...prev, [i]: 'failed' }));
                setIsInstalling(false);
                return;
            }

            // Verify
            const postCheckRes = await checkRequirementStep(serverId, config.steps[i].checkCommand);
            if (postCheckRes.completed) {
                setStepStatus(prev => ({ ...prev, [i]: 'completed' }));
            } else {
                toast({ variant: 'destructive', title: `Step ${i + 1} Verification Failed`, description: "Command ran but check failed." });
                setStepStatus(prev => ({ ...prev, [i]: 'failed' }));
                setIsInstalling(false);
                return;
            }
        }

        toast({ title: 'Success', description: `${config.title} is fully configured.` });
        setIsInstalling(false);
    };

    const handleUninstall = async () => {
        if (!config || !serverId) return;

        if (!confirm(`Are you sure you want to completely remove ${config.title}? This is destructive and irreversible.`)) {
            return;
        }

        setIsUninstalling(true);

        // Run uninstall commands in reverse order
        for (let i = config.steps.length - 1; i >= 0; i--) {
            const step = config.steps[i];
            if (!step.uninstallCommand) continue;

            setStepStatus(prev => ({ ...prev, [i]: 'checking' }));

            const uninstallRes = await uninstallRequirementStep(serverId, step.uninstallCommand);
            if (uninstallRes.error) {
                // We warn but continue, as partial uninstalls are common/messy
                toast({ variant: 'destructive', title: `Uninstall Step ${i + 1} Warning`, description: uninstallRes.error });
            }

            // Verify it's gone (checkCommand should fail/return false)
            const postCheckRes = await checkRequirementStep(serverId, step.checkCommand);
            if (!postCheckRes.completed) {
                setStepStatus(prev => ({ ...prev, [i]: 'pending' })); // Reset to pending
            } else {
                // If check still passes, uninstall might have failed
                setStepStatus(prev => ({ ...prev, [i]: 'failed' }));
            }
        }

        toast({ title: 'Uninstalled', description: `${config.title} has been removed.` });
        setIsUninstalling(false);
        checkAllSteps(); // Refresh state
    };

    if (!config) {
        return <div className="p-8">Requirement not found.</div>;
    }

    if (!serverId) {
        return <div className="p-8 text-center text-muted-foreground">Please select a server first.</div>;
    }

    const allCompleted = config.steps.every((_, i) => stepStatus[i] === 'completed');

    return (
        <div className="space-y-8 max-w-5xl animate-in fade-in duration-500 pb-10">
            <PageTitleBack
                title={`${config.title} Requirement`}
                description={config.description}
                serverName={serverName}
                backHref="/server/system/requirement"
            />

            {/* Installation Steps - Attached Cards List */}
            <div className="space-y-4">
                <h3 className="text-xl font-semibold px-1">Installation Steps</h3>
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                    {isLoading ? (
                        // Skeleton Steps
                        [1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-5 w-48" />
                                    <Skeleton className="h-4 w-full max-w-md" />
                                </div>
                            </div>
                        ))
                    ) : (
                        // Real Steps
                        config.steps.map((step, index) => {
                            const status = stepStatus[index] || 'pending';
                            const isCompleted = status === 'completed';
                            const isChecking = status === 'checking';
                            const isFailed = status === 'failed';

                            return (
                                <div
                                    key={index}
                                    className={cn(
                                        "flex items-center gap-4 p-4 border-b last:border-0 transition-all hover:bg-muted/50",
                                        isCompleted && "bg-muted/30"
                                    )}
                                >
                                    <div className="shrink-0">
                                        {isChecking ? (
                                            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                                                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                                            </div>
                                        ) : isCompleted ? (
                                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                            </div>
                                        ) : isFailed ? (
                                            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                                                <XCircle className="h-5 w-5 text-red-600" />
                                            </div>
                                        ) : (
                                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border border-muted-foreground/20">
                                                <Icon name={step.icon} className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className={cn(
                                            "text-base font-medium mb-1",
                                            isCompleted && "text-green-900",
                                            isFailed && "text-red-900"
                                        )}>
                                            {step.name}
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            {step.description}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {/* Installation Action Item */}
                    {isLoading ? (
                        <div className="p-4 border-t bg-muted/10">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="space-y-2 flex-1 w-full">
                                    <Skeleton className="h-5 w-32" />
                                    <Skeleton className="h-4 w-64" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div
                            onClick={!allCompleted && !isInstalling ? handleInstall : undefined}
                            className={cn(
                                "flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t transition-all",
                                allCompleted
                                    ? "bg-muted/5 opacity-70 cursor-not-allowed"
                                    : "hover:bg-muted/50 cursor-pointer bg-muted/10",
                                (isInstalling) && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <div className="space-y-1 text-center sm:text-left flex-1">
                                <h3 className="font-medium flex items-center gap-2">
                                    {allCompleted ? (
                                        <>
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                            App Already Installed
                                        </>
                                    ) : (
                                        <>
                                            <Icons.Download className="h-4 w-4" />
                                            {isInstalling ? "Installing Application..." : "Install Application"}
                                        </>
                                    )}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {allCompleted
                                        ? "This requirement is fully configured on your server."
                                        : `Execute the steps above to install and configure ${config.title}.`
                                    }
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Uninstall Section - Show if any step is installed or failed (partial install) and uninstall commands exist */}
            {config.steps.some(s => s.uninstallCommand) && (
                <div className="space-y-4 pt-8">
                    <div className="flex items-center gap-2 px-1 text-destructive">
                        <Trash2 className="h-5 w-5" />
                        <h3 className="text-xl font-semibold">Uninstall Steps</h3>
                    </div>

                    <div className="rounded-lg border border-destructive/20 bg-card text-card-foreground shadow-sm overflow-hidden">
                        {config.steps.slice().reverse().map((step, rIndex) => {
                            if (!step.uninstallCommand) return null;
                            const index = config.steps.length - 1 - rIndex;
                            const status = stepStatus[index] || 'pending';
                            const isGone = status === 'pending';
                            const isChecking = status === 'checking';

                            return (
                                <div
                                    key={index}
                                    className={cn(
                                        "flex items-center gap-4 p-4 border-b last:border-0 transition-all border-destructive/10",
                                        isGone ? "bg-muted/50 opacity-60" : "bg-destructive/5"
                                    )}
                                >
                                    <div className="shrink-0">
                                        {isChecking ? (
                                            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                                                <Loader2 className="h-5 w-5 text-destructive animate-spin" />
                                            </div>
                                        ) : isGone ? (
                                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border">
                                                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                        ) : (
                                            <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center border border-destructive/20">
                                                <Trash2 className="h-5 w-5 text-destructive/70" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-base font-medium text-destructive/90 mb-1">
                                            Revert: {step.name}
                                        </h4>
                                        <p className="text-sm text-destructive/70">
                                            Removes configurations and packages.
                                        </p>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Uninstall Action Item */}
                        <div
                            onClick={!isUninstalling ? handleUninstall : undefined}
                            className={cn(
                                "flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-destructive/10 transition-all hover:bg-destructive/10 cursor-pointer bg-destructive/5",
                                (isUninstalling) && "opacity-70 cursor-not-allowed hover:bg-destructive/5"
                            )}
                        >
                            <div className="space-y-1 text-center sm:text-left flex-1">
                                <h3 className="font-medium text-destructive flex items-center justify-center sm:justify-start gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    {isUninstalling ? "Wiping Application..." : "Uninstall Application"}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Completely remove {config.title}. This action is destructive.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
