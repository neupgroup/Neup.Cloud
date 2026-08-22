'use client';

/*
::neup.documentation::system-requirement-detail-page

Displays requirement installation status for the active server and keeps all
actions bound to the selected server from the URL-backed server context.

::end
*/

import { useParams } from 'next/navigation';
import { requirements } from '@/services/server/requirement-list';
import { PageTitleBack } from '@/components/page-header';
import { useToast } from '@/core/hooks/useToast';
import { useState, useEffect } from 'react';
import { checkRequirementStep, installRequirementStep, uninstallRequirementStep, updateRequirementStep } from '../runner';
import * as Icons from 'lucide-react';
import { cn } from '@/core/utils';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { useServerName } from '@/inapp/hooks/use-server-name';
import { useSelectedServerHref, useSelectedServerId } from '@/inapp/hooks/use-selected-server';

type StepState = 'pending' | 'checking' | 'installing' | 'uninstalling' | 'verifying' | 'completed' | 'failed';

type StepActivity = {
    state: StepState;
    detail: string;
    output?: string;
};

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
    const serverId = useSelectedServerId();
    const withSelectedServer = useSelectedServerHref();

    const [stepActivity, setStepActivity] = useState<Record<number, StepActivity>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [isUninstalling, setIsUninstalling] = useState(false);
    const [isRepairing, setIsRepairing] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateStepStatus, setUpdateStepStatus] = useState<Record<number, 'pending' | 'checking' | 'completed' | 'failed'>>({});
    const [updateStepOutput, setUpdateStepOutput] = useState<Record<number, string>>({});

    useEffect(() => {
        if (config && serverId) {
            void checkAllSteps();
        } else {
            setIsLoading(false);
        }
    }, [config, serverId]);

    const setStep = (index: number, state: StepState, detail: string, output?: string) => {
        setStepActivity(prev => ({
            ...prev,
            [index]: {
                state,
                detail,
                output,
            },
        }));
    };

    const getStepState = (index: number): StepState => stepActivity[index]?.state ?? 'pending';

    const checkAllSteps = async () => {
        if (!config || !serverId) return;

        setIsLoading(true);
        setStepActivity({});

        for (let i = 0; i < config.steps.length; i++) {
            setStep(i, 'checking', 'Checking current server state...');

            const res = await checkRequirementStep(serverId, config.steps[i].checkCommand);

            if (res.error) {
                setStep(i, 'failed', 'Status check failed.', res.error);
            } else if (res.completed) {
                setStep(i, 'completed', 'Installed and verified.', res.output);
            } else {
                setStep(i, 'pending', 'Not installed yet.');
            }
        }

        setIsLoading(false);
    };

    const handleInstall = async () => {
        if (!config || !serverId) return;
        setIsInstalling(true);

        for (let i = 0; i < config.steps.length; i++) {
            setStep(i, 'checking', 'Checking whether this step is already configured...');
            const preCheckRes = await checkRequirementStep(serverId, config.steps[i].checkCommand);

            if (preCheckRes.completed) {
                setStep(i, 'completed', 'Already installed. Skipping this step.', preCheckRes.output);
                continue;
            }

            setStep(i, 'installing', `Installing step ${i + 1}: ${config.steps[i].name}...`);
            const installRes = await installRequirementStep(serverId, config.steps[i].installCommand, id);
            if (installRes.error) {
                toast({ variant: 'destructive', title: `Step ${i + 1} Failed`, description: installRes.error });
                setStep(i, 'failed', 'Installation failed.', installRes.error);
                setIsInstalling(false);
                return;
            }

            setStep(i, 'verifying', 'Verifying installation...', installRes.output?.trim() || undefined);
            const postCheckRes = await checkRequirementStep(serverId, config.steps[i].checkCommand);
            if (postCheckRes.completed) {
                setStep(i, 'completed', 'Installed and verified.', postCheckRes.output || installRes.output);
            } else {
                toast({ variant: 'destructive', title: `Step ${i + 1} Verification Failed`, description: "Command ran but check failed." });
                setStep(i, 'failed', 'Verification failed after install.', postCheckRes.error || installRes.output);
                setIsInstalling(false);
                return;
            }
        }

        toast({ title: 'Success', description: `${config.title} is fully configured.` });
        setIsInstalling(false);
        await checkAllSteps();
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

            setStep(i, 'uninstalling', `Removing step ${i + 1}: ${step.name}...`);

            const uninstallRes = await uninstallRequirementStep(serverId, step.uninstallCommand, id);
            if (uninstallRes.error) {
                // We warn but continue, as partial uninstalls are common/messy
                toast({ variant: 'destructive', title: `Uninstall Step ${i + 1} Warning`, description: uninstallRes.error });
                setStep(i, 'failed', 'Removal command reported an error.', uninstallRes.error);
            }

            // Verify it's gone (checkCommand should fail/return false)
            setStep(i, 'verifying', 'Verifying that the step was removed...', uninstallRes.output?.trim() || undefined);
            const postCheckRes = await checkRequirementStep(serverId, step.checkCommand);
            if (!postCheckRes.completed) {
                setStep(i, 'pending', 'Removed successfully. Ready to install again.');
            } else {
                // If check still passes, uninstall might have failed
                setStep(i, 'failed', 'Removal verification failed. The step still appears installed.', postCheckRes.output);
            }
        }

        toast({ title: 'Uninstalled', description: `${config.title} has been removed.` });
        setIsUninstalling(false);
        await checkAllSteps(); // Refresh state
    };

    const handleRepair = async () => {
        if (!config || !serverId) return;

        if (!confirm(`Repair ${config.title}? This will run uninstall and then install in one action.`)) {
            return;
        }

        setIsRepairing(true);

        // 1) Attempt full uninstall in reverse order.
        for (let i = config.steps.length - 1; i >= 0; i--) {
            const step = config.steps[i];
            if (!step.uninstallCommand) continue;

            setStep(i, 'uninstalling', `Repair phase 1 of 2: removing step ${i + 1}...`);

            const uninstallRes = await uninstallRequirementStep(serverId, step.uninstallCommand, id);
            if (uninstallRes.error) {
                toast({
                    variant: 'destructive',
                    title: `Repair Uninstall Step ${i + 1} Warning`,
                    description: uninstallRes.error,
                });
                setStep(i, 'failed', 'Repair removal command reported an error.', uninstallRes.error);
            }

            setStep(i, 'verifying', 'Verifying that the old setup is gone...', uninstallRes.output?.trim() || undefined);
            const postCheckRes = await checkRequirementStep(serverId, step.checkCommand);
            if (!postCheckRes.completed) {
                setStep(i, 'pending', 'Removed. Waiting for fresh install.');
            } else {
                setStep(i, 'failed', 'Repair removal verification failed.', postCheckRes.output);
            }
        }

        // 2) Re-install and verify each step in order.
        for (let i = 0; i < config.steps.length; i++) {
            setStep(i, 'installing', `Repair phase 2 of 2: installing step ${i + 1}...`);
            const installRes = await installRequirementStep(serverId, config.steps[i].installCommand, id);

            if (installRes.error) {
                toast({
                    variant: 'destructive',
                    title: `Repair Install Step ${i + 1} Failed`,
                    description: installRes.error,
                });
                setStep(i, 'failed', 'Fresh install failed during repair.', installRes.error);
                setIsRepairing(false);
                return;
            }

            setStep(i, 'verifying', 'Verifying the fresh install...', installRes.output?.trim() || undefined);
            const verifyRes = await checkRequirementStep(serverId, config.steps[i].checkCommand);
            if (verifyRes.completed) {
                setStep(i, 'completed', 'Reinstalled and verified.', verifyRes.output || installRes.output);
            } else {
                toast({
                    variant: 'destructive',
                    title: `Repair Verification Step ${i + 1} Failed`,
                    description: verifyRes.error || 'Command ran but check failed.',
                });
                setStep(i, 'failed', 'Repair verification failed.', verifyRes.error || installRes.output);
                setIsRepairing(false);
                return;
            }
        }

        toast({ title: 'Repair Complete', description: `${config.title} was uninstalled and installed successfully.` });
        setIsRepairing(false);
        await checkAllSteps();
    };

    const handleUpdate = async () => {
        if (!config?.updateAction || !serverId) return;

        const confirmationMessage = config.updateAction.confirmMessage || `Update ${config.title} now?`;
        if (!confirm(confirmationMessage)) {
            return;
        }

        setIsUpdating(true);
        setUpdateStepStatus({});
        setUpdateStepOutput({});
        const nextOutputs: Record<number, string> = {};

        for (let i = 0; i < config.updateAction.steps.length; i++) {
            const step = config.updateAction.steps[i];
            const command = step.installCommand || step.checkCommand;

            setUpdateStepStatus(prev => ({ ...prev, [i]: 'checking' }));

            const updateRes = await updateRequirementStep(serverId, command, id);
            if (updateRes.error) {
                toast({
                    variant: 'destructive',
                    title: `${config.title} Update Step ${i + 1} Failed`,
                    description: updateRes.error,
                });
                setUpdateStepStatus(prev => ({ ...prev, [i]: 'failed' }));
                setIsUpdating(false);
                return;
            }

            const output = updateRes.output?.trim() || 'Completed';
            nextOutputs[i] = output;
            setUpdateStepStatus(prev => ({ ...prev, [i]: 'completed' }));
            setUpdateStepOutput(prev => ({ ...prev, [i]: output }));
        }

        const lastStepIndex = config.updateAction.steps.length - 1;
        const verificationSummary = nextOutputs[lastStepIndex] || '';

        toast({
            title: `${config.title} Updated`,
            description: verificationSummary
                ? `${config.updateAction.successMessage || `${config.title} update completed successfully.`} ${verificationSummary}`
                : config.updateAction.successMessage || `${config.title} update completed successfully.`,
        });

        setIsUpdating(false);
        await checkAllSteps();
    };

    if (!config) {
        return <div className="p-8">Requirement not found.</div>;
    }

    if (!serverId) {
        return <div className="p-8 text-center text-muted-foreground">Please select a server first.</div>;
    }

    const allCompleted = config.steps.every((_, i) => getStepState(i) === 'completed');
    const canRemove = config.steps.some(step => step.uninstallCommand);
    const showStandaloneRemove = canRemove && id !== 'system-logger';
    const isBusy = isInstalling || isUninstalling || isRepairing || isUpdating;
    const repairTitle = id === 'system-logger' ? 'Remove and Install Again' : 'Repair';
    const repairDescription = id === 'system-logger'
        ? 'Stops the logger, removes the current service and files, then installs a fresh copy step by step.'
        : 'Uninstalls and installs this requirement in one action.';

    return (
        <div className="space-y-8 max-w-5xl animate-in fade-in duration-500 pb-10">
            <PageTitleBack
                title={`${config.title} Requirement`}
                description={config.description}
                serverName={serverName}
                backHref={withSelectedServer("/server/system/requirement")}
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
                            const activity = stepActivity[index];
                            const status = activity?.state || 'pending';
                            const isCompleted = status === 'completed';
                            const isChecking = ['checking', 'installing', 'uninstalling', 'verifying'].includes(status);
                            const isFailed = status === 'failed';
                            const badgeLabel = status === 'installing'
                                ? 'Installing'
                                : status === 'uninstalling'
                                    ? 'Removing'
                                    : status === 'verifying'
                                        ? 'Verifying'
                                        : status === 'checking'
                                            ? 'Checking'
                                            : isCompleted
                                                ? 'Done'
                                                : isFailed
                                                    ? 'Failed'
                                                    : 'Pending';

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
                                            {index + 1}. {step.name}
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            {step.description}
                                        </p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                            <span
                                                className={cn(
                                                    'inline-flex items-center rounded-full px-2.5 py-1 font-medium',
                                                    isCompleted && 'bg-green-100 text-green-800',
                                                    isFailed && 'bg-red-100 text-red-800',
                                                    !isCompleted && !isFailed && status !== 'pending' && 'bg-blue-100 text-blue-800',
                                                    status === 'pending' && 'bg-muted text-muted-foreground'
                                                )}
                                            >
                                                {badgeLabel}
                                            </span>
                                            <span className={cn(
                                                'text-muted-foreground',
                                                isFailed && 'text-red-700',
                                                isCompleted && 'text-green-700'
                                            )}>
                                                {activity?.detail || 'Waiting to run this step.'}
                                            </span>
                                        </div>
                                        {activity?.output ? (
                                            <pre className="mt-2 overflow-x-auto rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                                                {activity.output}
                                            </pre>
                                        ) : null}
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
                            onClick={!allCompleted && !isBusy ? handleInstall : undefined}
                            className={cn(
                                "flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t transition-all",
                                allCompleted
                                    ? "bg-muted/5 opacity-70 cursor-not-allowed"
                                    : "hover:bg-muted/50 cursor-pointer bg-muted/10",
                                isBusy && "opacity-70 cursor-not-allowed"
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

                    {!isLoading && showStandaloneRemove && (
                        <div
                            onClick={!isBusy ? handleUninstall : undefined}
                            className={cn(
                                "flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t transition-all bg-red-50/60",
                                !isBusy
                                    ? "hover:bg-red-100/60 cursor-pointer"
                                    : "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <div className="space-y-1 text-center sm:text-left flex-1">
                                <h3 className="font-medium flex items-center gap-2 text-red-900 justify-center sm:justify-start">
                                    <Icons.Trash2 className="h-4 w-4" />
                                    {isUninstalling ? 'Removing Setup...' : 'Remove Setup'}
                                </h3>
                                <p className="text-sm text-red-800/80">
                                    Completely remove the current setup from this server.
                                </p>
                            </div>
                        </div>
                    )}

                    {!isLoading && canRemove && (
                        <div
                            onClick={!isBusy ? handleRepair : undefined}
                            className={cn(
                                "flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t transition-all bg-amber-50/60",
                                !isBusy
                                    ? "hover:bg-amber-100/60 cursor-pointer"
                                    : "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <div className="space-y-1 text-center sm:text-left flex-1">
                                <h3 className="font-medium flex items-center gap-2 text-amber-900 justify-center sm:justify-start">
                                    <Icons.Wrench className="h-4 w-4" />
                                    {isRepairing ? 'Repairing...' : repairTitle}
                                </h3>
                                <p className="text-sm text-amber-800/80">
                                    {repairDescription}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {config.updateAction && (
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold px-1">Update Now</h3>
                    <div className="rounded-lg border border-blue-200 bg-card text-card-foreground shadow-sm overflow-hidden">
                        {config.updateAction.steps.map((step, index) => {
                            const status = updateStepStatus[index] || 'pending';
                            const isCompleted = status === 'completed';
                            const isChecking = status === 'checking';
                            const isFailed = status === 'failed';
                            const output = updateStepOutput[index];

                            return (
                                <div
                                    key={index}
                                    className={cn(
                                        "flex items-center gap-4 p-4 border-b last:border-0 transition-all",
                                        isCompleted && "bg-blue-50/30"
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
                                            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-200">
                                                <Icon name={step.icon} className="h-5 w-5 text-blue-700" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className={cn(
                                            "text-base font-medium mb-1",
                                            isCompleted && "text-blue-900",
                                            isFailed && "text-red-900"
                                        )}>
                                            {index + 1}. {step.name}
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            {step.description}
                                        </p>
                                        {output && (
                                            <p className="mt-2 text-xs text-blue-900/70 break-words">
                                                {output}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        <div
                            onClick={!isUpdating && !isInstalling && !isUninstalling && !isRepairing ? handleUpdate : undefined}
                            className={cn(
                                "flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t transition-all bg-blue-50/60",
                                (!isUpdating && !isInstalling && !isUninstalling && !isRepairing)
                                    ? "hover:bg-blue-100/60 cursor-pointer"
                                    : "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <div className="space-y-1 text-center sm:text-left flex-1">
                                <h3 className="font-medium flex items-center gap-2 text-blue-900 justify-center sm:justify-start">
                                    {isUpdating ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Updating...
                                        </>
                                    ) : (
                                        <>
                                            <Icons.RefreshCw className="h-4 w-4" />
                                            {config.updateAction.title}
                                        </>
                                    )}
                                </h3>
                                <p className="text-sm text-blue-900/75">
                                    {config.updateAction.description}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
