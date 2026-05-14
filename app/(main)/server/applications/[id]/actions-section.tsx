// This file has been removed as it contains action logic.

'use client';

import { Card } from "@/components/ui/card";
import { cn } from "@/core/utils";
import { Loader2, Terminal, Zap } from "lucide-react";
import { useActionsSection, ActionsSectionProps } from "@/components/applications/actions-section";

export function ActionsSection({ application, isCommandRunning = false }: ActionsSectionProps) {
    const { customCommands, executing, handleExecute } = useActionsSection(application);
    if (!customCommands || customCommands.length === 0) return null;

    const ActionRow = ({
        name,
        command,
        isLast = false
    }: {
        name: string,
        command: string,
        isLast?: boolean
    }) => {
        const isLoading = executing === name;
        const isDisabled = isLoading || isCommandRunning;
        return (
            <div
                className={cn(
                    "p-4 min-w-0 w-full transition-colors group flex items-start gap-4",
                    !isLast && "border-b border-border",
                    isDisabled
                      ? "opacity-50 cursor-not-allowed select-none"
                      : "cursor-pointer hover:bg-muted/50"
                )}
                onClick={() => !isDisabled && handleExecute(name, command)}
            >
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-0 h-8">
                        <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground capitalize transition-colors group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                            {name}
                        </h3>
                        <div className="flex items-center gap-1">
                            <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-amber-500" /> : <Zap className="h-4 w-4 text-amber-500" />}
                            </div>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 font-mono">
                        {command}
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-500 delay-200">
            <h3 className="text-lg font-medium flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Actions
            </h3>
            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                {customCommands.map(([name, command], index) => (
                    <ActionRow
                        key={name}
                        name={name}
                        command={command as string}
                        isLast={index === customCommands.length - 1}
                    />
                ))}
            </Card>
        </div>
    );
}
