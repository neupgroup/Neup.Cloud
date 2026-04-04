'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { deleteSupervisorOnlyProcess, stopSupervisorOnlyProcess } from '../actions';
import { useToast } from '@/hooks/use-toast';

interface SupervisorOnlyActionsProps {
    processName: string;
}

export function SupervisorOnlyActions({ processName }: SupervisorOnlyActionsProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [isStopping, setIsStopping] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleStop = async () => {
        setIsStopping(true);
        try {
            await stopSupervisorOnlyProcess(processName);
            toast({
                title: 'Process stopped',
                description: `${processName} has been stopped.`,
            });
            router.refresh();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Stop failed',
                description: error.message || 'Could not stop the Supervisor process.',
            });
        } finally {
            setIsStopping(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteSupervisorOnlyProcess(processName);
            toast({
                title: 'Removed from Supervisor',
                description: `${processName} has been removed from Supervisor.`,
            });
            router.push('/server/applications');
            router.refresh();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Delete failed',
                description: error.message || 'Could not remove the Supervisor process.',
            });
            setIsDeleting(false);
        }
    };

    return (
        <div className="flex items-center gap-3">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2" disabled={isStopping || isDeleting}>
                        <Square className="h-4 w-4" />
                        {isStopping ? 'Stopping...' : 'Stop'}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Stop this Supervisor process?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will stop <strong>{processName}</strong> but keep its Supervisor configuration file.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleStop} disabled={isStopping || isDeleting}>
                            Stop Process
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2" disabled={isStopping || isDeleting}>
                        <Trash2 className="h-4 w-4" />
                        {isDeleting ? 'Deleting...' : 'Delete from Supervisor'}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this Supervisor process?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will stop <strong>{processName}</strong> and remove its Supervisor configuration file.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isStopping || isDeleting}
                        >
                            Delete from Supervisor
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
