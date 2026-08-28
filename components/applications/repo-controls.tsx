import { useToast } from '#/core/hooks/useToast';
import { useSelectedServerId } from '@/hooks/use-selected-server';
import { withSelectedServerQuery } from '@/helpers/navigation';
import { useState } from "react";
import Icon from '#/components/ui/icon';

import { performGitOperation } from '@/services/server/applications/service';

export interface RepoControlsProps {
    applicationId: string;
}

export function useRepoControls(applicationId: string) {
    const { toast } = useToast();
    const selectedServerId = useSelectedServerId();
    const [loading, setLoading] = useState<string | null>(null);
    const [operationStatus, setOperationStatus] = useState<{
        operation: 'clone' | 'pull' | 'pull-force' | 'reset-main';
        result: 'success' | 'error';
    } | null>(null);

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
        setOperationStatus(null);
        const messages = getOperationMessages(operation);
        const actions = [
            ['Open app', 'success', withSelectedServerQuery(`/server/applications/${applicationId}`, selectedServerId)],
            ['Dismiss', 'none', 'dismiss'],
        ] as [['Open app', 'success', string], ['Dismiss', 'none', 'dismiss']];

        const operationToast = toast({
            name: `application-git-${applicationId}`,
            convey: 'info',
            icon: operation === 'clone' || operation === 'pull'
                ? <Icon type="animated" from="Download" size={24} />
                : undefined,
            actions,
            title: messages.started,
            description: `Git operation '${operation}' has started.`,
        });

        try {
            await performGitOperation(applicationId, selectedServerId, operation);
            setOperationStatus({ operation, result: 'success' });
            operationToast.update({
                convey: 'success',
                icon: operation === 'clone' || operation === 'pull'
                    ? <Icon type="animated" from="Download" to="TickMark" position={2} size={24} />
                    : undefined,
                actions: [
                    ['Open app', 'success', withSelectedServerQuery(`/server/applications/${applicationId}`, selectedServerId)],
                    ['Dismiss', 'none', 'dismiss'],
                ],
                title: messages.completed,
                description: `Git operation '${operation}' completed successfully.`,
            });
        } catch (error: any) {
            console.error(error);
            setOperationStatus({ operation, result: 'error' });
            operationToast.update({
                convey: 'dangerous',
                icon: operation === 'clone' || operation === 'pull'
                    ? <Icon type="animated" from="Download" to="CrossMark" position={2} size={24} />
                    : undefined,
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

    return { loading, operationStatus, handleAction };
}
