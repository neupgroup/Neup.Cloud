'use client';

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Terminal } from "lucide-react";

interface CommandsSectionProps {
    application: any;
}

// Helper function to get command description
function getCommandDescription(name: string, command: string): string {
    const lowerName = name.toLowerCase();

    // Lifecycle commands
    if (lowerName === 'start' || lowerName === 'lifecycle.start') {
        return 'Start the application and make it available';
    }
    if (lowerName === 'stop' || lowerName === 'lifecycle.stop') {
        return 'Stop the running application process';
    }
    if (lowerName === 'restart' || lowerName === 'lifecycle.restart') {
        return 'Restart the application with the latest changes';
    }
    if (lowerName === 'build' || lowerName === 'lifecycle.build') {
        return 'Build the application for production deployment';
    }
    if (lowerName === 'dev' || lowerName === 'lifecycle.dev') {
        return 'Start the application in development mode with live reload';
    }
    if (lowerName === 'install' || lowerName === 'lifecycle.install') {
        return 'Install all required dependencies for the application';
    }

    // Generic fallback based on command content
    if (command.includes('pm2')) {
        return 'Process manager command for the application';
    }
    if (command.includes('npm') || command.includes('yarn')) {
        return 'Package manager command for dependencies';
    }
    if (command.includes('git')) {
        return 'Git version control command';
    }

    return 'Custom command for application management';
}

export function CommandsSection({ application }: CommandsSectionProps) {
    if (!application.commands || Object.keys(application.commands).length === 0) {
        return null;
    }

    const CommandRow = ({
        name,
        command,
        isLast = false
    }: {
        name: string,
        command: string,
        isLast?: boolean
    }) => {
        const title = name.replace('lifecycle.', '').split(/[-_]/).map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');

        const description = getCommandDescription(name, command);

        return (
            <div className={cn(
                "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4",
                !isLast && "border-b border-border"
            )}>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-0 h-8">
                        <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground">
                            {title}
                        </h3>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                        {description}
                    </p>
                </div>
            </div>
        );
    };

    const commands = Object.entries(application.commands);

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-500 delay-200">
            <h3 className="text-lg font-medium flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Lifecycle Commands
            </h3>

            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                {commands.map(([name, command], index) => (
                    <CommandRow
                        key={name}
                        name={name}
                        command={command as string}
                        isLast={index === commands.length - 1}
                    />
                ))}
            </Card>
        </div>
    );
}
