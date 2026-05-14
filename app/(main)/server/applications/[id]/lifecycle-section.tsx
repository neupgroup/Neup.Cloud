'use client';

import * as LucideIcons from "lucide-react";
import { Download, Hammer, Loader2, Play, PlayCircle, RefreshCw, StopCircle, Terminal } from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import { useToast } from '@/core/hooks/use-toast';
import { cn } from "@/core/utils";
import { executeApplicationCommand } from "@/services/server/applications/service";

interface LifecycleSectionProps {
  application: any;
  runningCommandName?: string | null;
}

export function LifecycleSection({ application, runningCommandName = null }: LifecycleSectionProps) {
  const { toast } = useToast();
  const [executing, setExecuting] = useState<string | null>(null);

  if (!application.commands) return null;

  const commandDefinitions = application.commandDefinitions || [];
  const isArray = Array.isArray(commandDefinitions);
  const hasDefinitions = isArray ? commandDefinitions.length > 0 : Object.keys(commandDefinitions).length > 0;

  let availableCommands: [string, any][] = [];

  if (isArray) {
    availableCommands = commandDefinitions
      .filter((def: any) => def.status === 'published')
      .map((def: any) => [def.title.toLowerCase(), def]);
  } else if (hasDefinitions) {
    availableCommands = Object.entries(commandDefinitions).filter(([, def]: [string, any]) => def.status === 'published');
  } else {
    availableCommands = Object.entries(application.commands).filter(([name]) => {
      const lifecycleNames = ['install', 'start', 'stop', 'restart', 'build', 'dev', 'lifecycle.install', 'lifecycle.start', 'lifecycle.stop', 'lifecycle.restart', 'lifecycle.build', 'lifecycle.dev'];
      return lifecycleNames.includes(name) || name.startsWith('lifecycle.');
    });
  }

  if (availableCommands.length === 0) return null;

  const getIconComponent = (iconName: string) => {
    const iconMap = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
    return iconMap[iconName] || Terminal;
  };

  const getIconFromName = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('start')) return PlayCircle;
    if (lower.includes('stop')) return StopCircle;
    if (lower.includes('restart')) return RefreshCw;
    if (lower.includes('build')) return Hammer;
    if (lower.includes('install')) return Download;
    if (lower.includes('dev')) return Terminal;
    return Terminal;
  };

  const getDescription = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('install')) return 'Install dependencies and prepare the application';
    if (lower.includes('build')) return 'Build the application for production';
    if (lower.includes('dev')) return 'Start the application in development mode';
    if (lower.includes('start')) return 'Start the application in production mode';
    if (lower.includes('stop')) return 'Stop the running application';
    if (lower.includes('restart')) return 'Restart the application with latest changes';
    return 'Execute lifecycle command';
  };

  const handleExecute = async (name: string, command: string, displayCommand: string) => {
    setExecuting(name);
    try {
      await executeApplicationCommand(application.id, command, name, displayCommand);
      toast({
        title: "Command Started",
        description: `Executing ${name}...`,
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

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-500 delay-150">
      <h3 className="text-lg font-medium flex items-center gap-2">
        <Play className="h-5 w-5" />
        Lifecycle
      </h3>

      <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        {availableCommands.map(([name, commandOrDef], index) => {
          const isDefinition = typeof commandOrDef === 'object';
          const definition = isDefinition ? commandOrDef : null;
          const command = isDefinition ? application.commands[name] : commandOrDef;
          const displayCommand = isDefinition ? (definition._mainCommand || definition?.command?.mainCommand || command) : command;

          const displayName = definition?.title || name.replace('lifecycle.', '');
          const description = definition?.description || getDescription(name);
          const Icon = definition?.icon ? getIconComponent(definition.icon) : getIconFromName(name);
          const type = definition?.type || 'normal';
          const isLoading = executing === name;
          const isDestructive = type === 'destructive';

          // Any running command disables all cards; spinner only on the active one
          const isAnyRunning = runningCommandName !== null;
          const isThisRunning = runningCommandName === displayName.toLowerCase() || runningCommandName === name.toLowerCase();
          const isDisabled = isLoading || isAnyRunning;

          return (
            <div
              key={name}
              className={cn(
                "p-4 min-w-0 w-full transition-colors group flex items-start gap-4",
                index !== availableCommands.length - 1 && "border-b border-border",
                isDisabled
                  ? "opacity-50 cursor-not-allowed select-none"
                  : "cursor-pointer hover:bg-muted/50"
              )}
              onClick={() => !isDisabled && handleExecute(name, command, displayCommand)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between mb-0 h-8">
                  <div className="flex items-center gap-2 min-w-0">
                    {isThisRunning && (
                      <Loader2 className="h-4 w-4 animate-spin shrink-0 text-muted-foreground" />
                    )}
                    <h3
                      className={cn(
                        "font-semibold leading-none tracking-tight truncate pr-4 capitalize transition-colors group-hover:underline decoration-muted-foreground/30 underline-offset-4",
                        isDestructive ? "text-destructive" : "text-foreground"
                      )}
                    >
                      {displayName}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <div
                      className={cn(
                        "h-8 w-8 flex items-center justify-center transition-colors",
                        isDestructive ? "text-destructive/70 group-hover:text-destructive" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                </div>
                <p className={cn("text-sm line-clamp-2", isDestructive ? "text-destructive/70" : "text-muted-foreground")}>
                  {description}
                </p>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
