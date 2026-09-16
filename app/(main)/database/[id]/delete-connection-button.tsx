// Merged into page.tsx and can be deleted.
'use client';

import { Button } from '@neup/components/ui/button';
import { useToast } from '@neup/core/hooks/useToast';
import { deleteDatabaseConnection } from '@/services/database/management';
import { useRouter } from 'next/navigation';

export function DeleteConnectionButton({ connectionId }: { connectionId: string }) {
  const { toast } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    try {
      const result = await deleteDatabaseConnection(connectionId);
      toast({
        title: 'Connection deleted',
        description: result.message,
      });
      router.push('/database');
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error?.message || 'Unable to delete connection.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button onClick={handleDelete} type="solid">
      Delete connection
    </Button>
  );
}
