import { Button } from '#/components/ui/button';
import { Trash } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '#/core/hooks/useToast';
import { ConfirmDialog } from '@/components/confirm-dialog';

import { ReactNode } from "react";
interface DeleteButtonProps {
    onDelete: () => Promise<void> | void;
    label?: string;
    confirmTitle?: string;
    confirmDescription?: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    iconOnly?: boolean;
    className?: string;
}

export function DeleteButton({
    onDelete,
    label = "Delete",
    confirmTitle = "Are you sure?",
    confirmDescription = "This action cannot be undone.",
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    iconOnly = false,
    className = "",
}: DeleteButtonProps) {
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirm = async () => {
        setIsDeleting(true);
        try {
            await onDelete();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to delete.",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <ConfirmDialog
            trigger={
                <Button
                    size={iconOnly ? "icon" : undefined}
                    variant={iconOnly ? "ghost" : "destructive"}
                    className={className}
                >
                    <Trash className="h-4 w-4" />
                    {!iconOnly && label}
                </Button>
            }
            title={confirmTitle}
            description={confirmDescription}
            confirmLabel={isDeleting ? "Deleting..." : confirmLabel}
            cancelLabel={cancelLabel}
            onConfirm={handleConfirm}
            loading={isDeleting}
        />
    );
}
