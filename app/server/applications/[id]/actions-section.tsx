
'use client';

import { executeApplicationCommand } from "@/app/server/applications/actions";
import { Card } from "@/components/ui/card";
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { Loader2, Terminal, Zap } from "lucide-react";
import { useState } from "react";

interface ActionsSectionProps {
    application: any;
}

export function ActionsSection({ application }: ActionsSectionProps) {
    const { toast } = useToast();
    const [executing, setExecuting] = useState<string | null>(null);

    if (!application.commands) return null;

    const lifecycleNames = ['start', 'stop', 'restart', 'build', 'dev', 'lifecycle.start', 'lifecycle.stop', 'lifecycle.restart', 'lifecycle.build', 'lifecycle.dev'];

    const customCommands = Object.entries(application.commands).filter(([name]) =>
        !lifecycleNames.includes(name) && !name.startsWith('lifecycle.')
    );

    if (customCommands.length === 0) return null;

    const handleExecute = async (name: string, command: string) => {
        setExecuting(name);
        try {
            await executeApplicationCommand(application.id, command, name);
            toast({
                title: "Action Started",
                description: `Running custom action ${name}...`,
            });
        } catch (error: any) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Execution Failed",
                description: error.message,
            });
        } finally {
            setExecuting(null);
        }
    };

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

        return (
            <div
                className={cn(
                    "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer",
                    !isLast && "border-b border-border",
                    isLoading && "opacity-50 pointer-events-none"
                )}
                onClick={() => !isLoading && handleExecute(name, command)}
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
