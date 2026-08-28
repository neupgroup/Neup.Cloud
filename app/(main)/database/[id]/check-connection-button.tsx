// Merged into page.tsx and can be deleted.
'use client';

import { Button } from '@/component/ui/button';
import { useToast } from '@/core/hooks/useToast';
import { checkDatabaseConnection } from '@/services/database/management';

export function CheckConnectionButton({ connectionId }: { connectionId: string }) {
  const { toast } = useToast();

  const handleCheck = async () => {
    try {
      const result = await checkDatabaseConnection(connectionId);
      toast({
        title: result.success ? 'Connection healthy' : 'Connection failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error: any) {
      toast({
        title: 'Connection check failed',
        description: error?.message || 'Unable to check connection.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button onClick={handleCheck} variant="outline">
      Check for connection
    </Button>
  );
}
