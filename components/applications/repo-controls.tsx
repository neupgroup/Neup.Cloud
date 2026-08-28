import { useToast } from '#/core/hooks/useToast';
import { useSelectedServerId } from '@/hooks/use-selected-server';
import { withSelectedServerQuery } from '@/helpers/navigation';
import { useState } from "react";

import { performGitOperation } from '@/services/server/applications/service';

export interface RepoControlsProps {
    applicationId: string;
}

export function useRepoControls(applicationId: string) {
    const { toast } = useToast();
    const selectedServerId = useSelectedServerId();
    const [loading, setLoading] = useState<string | null>(null);

    const getOperationMessages = (operation: 'clone' | 'pull' | 'pull-force' | 'reset-main') => {
        if (operation === 'clone') {
            return {
                started: 'Clone Started',
                completed: 'Clone Completed',
                failed: 'Clone Failed',
            };
        }

        if (operation === 'reset-main') {
            return {
                started: 'Reset Started',
                completed: 'Resetted to Main',
                failed: 'Reset Failed',
            };
        }

        return {
            started: 'Pull Started',
            completed: operation === 'pull-force' ? 'Pulled from Origin' : 'Pull Completed',
            failed: 'Pull Failed',
        };
    };

    const handleAction = async (operation: 'clone' | 'pull' | 'pull-force' | 'reset-main') => {
        setLoading(operation);
        const messages = getOperationMessages(operation);
        const actions = [
            ['Open app', 'success', withSelectedServerQuery(`/server/applications/${applicationId}`, selectedServerId)],
            ['Dismiss', 'none', 'dismiss'],
        ] as [['Open app', 'success', string], ['Dismiss', 'none', 'dismiss']];

        toast({
            name: `application-git-${applicationId}`,
            convey: 'info',
            actions,
            title: messages.started,
            description: `Git operation '${operation}' has started.`,
        });

        try {
            await performGitOperation(applicationId, selectedServerId, operation);
            toast({
                name: `application-git-${applicationId}`,
                convey: 'success',
                actions: [
                    ['Open app', 'success', withSelectedServerQuery(`/server/applications/${applicationId}`, selectedServerId)],
                    ['Dismiss', 'none', 'dismiss'],
                ],
                title: messages.completed,
                description: `Git operation '${operation}' completed successfully.`,
            });
        } catch (error: any) {
            console.error(error);
            toast({
                name: `application-git-${applicationId}`,
                convey: 'dangerous',
                actions: [
                    ['Open app', 'danger', withSelectedServerQuery(`/server/applications/${applicationId}`, selectedServerId)],
                    ['Dismiss', 'none', 'dismiss'],
                ],
                state: 'error',
                title: messages.failed,
                description: error.message || "Could not perform git operation.",
            });
        } finally {
            setLoading(null);
        }
    };

    return { loading, handleAction };
}
