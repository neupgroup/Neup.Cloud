'use client';

import { Button } from '#/components/ui/button';
import { Trash } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '#/core/hooks/useToast';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { deleteApplication } from '@/services/server/applications/service';
import { useSelectedServerId } from '@/hooks/use-selected-server';
import { withSelectedServerQuery } from '@/helpers/navigation';

interface DeleteApplicationButtonProps {
    applicationId: string;
}

export function DeleteApplicationButton({ applicationId }: DeleteApplicationButtonProps) {
    const { toast } = useToast();
    const router = useRouter();
    const selectedServerId = useSelectedServerId();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteApplication(applicationId);
            toast({
                title: "Application deleted",
                description: "The application has been stopped and removed.",
            });
            router.push(withSelectedServerQuery('/server/applications', selectedServerId));
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to delete application.",
            });
            setIsDeleting(false);
        }
    };

    return (
        <ConfirmDialog
            trigger={
                <Button type="solid" convey="danger" className="gap-2">
                    <Trash className="h-4 w-4" />
                    Delete Application
                </Button>
            }
            title="Are you absolutely sure?"
            description={
                <span>
                    This action cannot be undone. The application will be <strong>closed/stopped</strong> immediately.<br /><br />
                    Note: For security reasons, the underlying files <strong>will not be deleted</strong> from the server automatically. You must manually remove them if desired.
                </span>
            }
            confirmLabel={isDeleting ? "Deleting..." : "Delete Application"}
            cancelLabel="Cancel"
            onConfirm={handleDelete}
            loading={isDeleting}
        />
    );
}
