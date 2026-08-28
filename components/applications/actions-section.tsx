import { useToast } from '#/core/hooks/useToast';
import { useSelectedServerId } from '@/hooks/use-selected-server';
import { withSelectedServerQuery } from '@/helpers/navigation';
import { useState } from "react";

import { executeApplicationCommand } from "@/services/server/applications/service";

export interface ActionsSectionProps {
    application: any;
    isCommandRunning?: boolean;
}

export function useActionsSection(application: any) {
    const { toast } = useToast();
    const selectedServerId = useSelectedServerId();
    const [executing, setExecuting] = useState<string | null>(null);

    if (!application.commands) return { customCommands: [], executing, handleExecute: () => {} };

    const lifecycleNames = ['start', 'stop', 'restart', 'build', 'dev', 'lifecycle.start', 'lifecycle.stop', 'lifecycle.restart', 'lifecycle.build', 'lifecycle.dev'];

    const customCommands = Object.entries(application.commands).filter(([name]) =>
        !lifecycleNames.includes(name) && !name.startsWith('lifecycle.')
    );

    const handleExecute = async (name: string, command: string) => {
        setExecuting(name);
        try {
            await executeApplicationCommand(application.id, command, selectedServerId, name);
            toast({
                name: `application-action-${application.id}`,
                convey: 'success',
                actions: [
                    ['Open app', 'success', withSelectedServerQuery(`/server/applications/${application.id}`, selectedServerId)],
                    ['Dismiss', 'none', 'dismiss'],
                ],
                title: "Action Started",
                description: `Running custom action ${name}...`,
            });
        } catch (error: any) {
            console.error(error);
            toast({
                name: `application-action-${application.id}`,
                convey: 'dangerous',
                actions: [
                    ['Open app', 'danger', withSelectedServerQuery(`/server/applications/${application.id}`, selectedServerId)],
                    ['Dismiss', 'none', 'dismiss'],
                ],
                variant: "destructive",
                title: "Execution Failed",
                description: error.message,
            });
        } finally {
            setExecuting(null);
        }
    };

    return { customCommands, executing, handleExecute };
}
