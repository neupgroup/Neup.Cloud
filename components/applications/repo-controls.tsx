import { useToast } from '@/core/hooks/use-toast';
import { useSelectedServerId } from '@/core/hooks/use-selected-server';
import { useState } from "react";

import { performGitOperation } from '@/services/server/applications/service';

export interface RepoControlsProps {
    applicationId: string;
}

export function useRepoControls(applicationId: string) {
    const { toast } = useToast();
    const selectedServerId = useSelectedServerId();
    const [loading, setLoading] = useState<string | null>(null);

    const handleAction = async (operation: 'clone' | 'pull' | 'pull-force' | 'reset-main') => {
        setLoading(operation);
        try {
            await performGitOperation(applicationId, selectedServerId, operation);
            toast({
                title: "Operation Started",
                description: `Git operation '${operation}' has been dispatched.`,
            });
        } catch (error: any) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Operation Failed",
                description: error.message || "Could not perform git operation.",
            });
        } finally {
            setLoading(null);
        }
    };

    return { loading, handleAction };
}
