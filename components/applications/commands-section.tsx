import { Card } from "@/component/ui/card";
import { cn } from "@/core/utils";
import { Terminal } from "lucide-react";

export interface CommandsSectionProps {
  application: any;
}

export function getCommandDescription(name: string, command: string): string {
  const lowerName = name.toLowerCase();
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

  const commands = Object.entries(application.commands);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-500 delay-200">
      <h3 className="text-lg font-medium flex items-center gap-2">
        <Terminal className="h-5 w-5" />
        Lifecycle Commands
      </h3>

      <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        {commands.map(([name, command], index) => {
          const title = name
            .replace('lifecycle.', '')
            .split(/[-_]/)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          return (
            <div
              key={name}
              className={cn(
                "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4",
                index !== commands.length - 1 && "border-b border-border"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between mb-0 h-8">
                  <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground">
                    {title}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {getCommandDescription(name, String(command))}
                </p>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
