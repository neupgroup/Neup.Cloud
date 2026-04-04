
'use client';

import { Button } from "@/components/ui/button";
import { useToast } from '@/hooks/use-toast';
import { Download, GitPullRequest, RefreshCw, RotateCcw } from "lucide-react";
import { useState } from "react";
import { performGitOperation } from "./actions";

interface RepoControlsProps {
    applicationId: string;
}

export function RepoControls({ applicationId }: RepoControlsProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState<string | null>(null);

    const handleAction = async (operation: 'clone' | 'pull' | 'pull-force' | 'reset-main') => {
        setLoading(operation);
        try {
            await performGitOperation(applicationId, operation);
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

    return (
        <div className="flex flex-wrap gap-2 pt-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction('clone')}
                disabled={!!loading}
            >
                <Download className="mr-2 h-4 w-4" />
                {loading === 'clone' ? 'Cloning...' : 'Clone Repository'}
            </Button>

            <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction('reset-main')}
                disabled={!!loading}
            >
                <RotateCcw className="mr-2 h-4 w-4" />
                {loading === 'reset-main' ? 'Resetting...' : 'Reset to Main'}
            </Button>

            <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction('pull')}
                disabled={!!loading}
            >
                <GitPullRequest className="mr-2 h-4 w-4" />
                {loading === 'pull' ? 'Pulling...' : 'Pull'}
            </Button>

            <Button
                variant="destructive"
                size="sm"
                onClick={() => handleAction('pull-force')}
                disabled={!!loading}
            >
                <RefreshCw className="mr-2 h-4 w-4" />
                {loading === 'pull-force' ? 'Forcing...' : 'Force Pull'}
            </Button>
        </div>
    );
}
