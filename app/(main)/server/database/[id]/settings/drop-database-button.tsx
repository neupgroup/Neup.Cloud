'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/core/hooks/use-toast';
import { withSelectedServerQuery } from '@/core/server-context';
import { dropDatabaseInstance } from '@/services/database/database-runtime';

type DropDatabaseButtonProps = {
    serverId: string;
    engine: 'mariadb' | 'postgres';
    dbName: string;
};

export function DropDatabaseButton({ serverId, engine, dbName }: DropDatabaseButtonProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [confirmValue, setConfirmValue] = useState('');
    const [isDropping, setIsDropping] = useState(false);

    const handleDrop = async () => {
        if (confirmValue !== dbName) {
            return;
        }

        setIsDropping(true);
        try {
            const result = await dropDatabaseInstance(serverId, engine, dbName);
            if (result.success) {
                toast({
                    title: 'Database dropped',
                    description: result.message,
                });
                router.replace(withSelectedServerQuery('/server/database', serverId));
                return;
            }

            toast({
                title: 'Drop failed',
                description: result.message,
                variant: 'destructive',
            });
        } catch (error: any) {
            toast({
                title: 'Drop failed',
                description: error.message || 'Failed to drop database.',
                variant: 'destructive',
            });
        } finally {
            setIsDropping(false);
        }
    };

    return (
        <ConfirmDialog
            trigger={
                <Button variant="destructive" disabled={isDropping}>
                    {isDropping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    <span className="ml-2">Drop Database</span>
                </Button>
            }
            title={`Drop ${dbName}?`}
            description={
                <div className="space-y-4">
                    <p>This permanently deletes the database, all tables, and all data.</p>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-db-name">Type <span className="font-mono">{dbName}</span> to confirm</Label>
                        <Input
                            id="confirm-db-name"
                            value={confirmValue}
                            onChange={(event) => setConfirmValue(event.target.value)}
                            placeholder={dbName}
                            autoComplete="off"
                            className="font-mono"
                        />
                    </div>
                </div>
            }
            confirmLabel="Drop Database"
            onConfirm={handleDrop}
            loading={isDropping}
            confirmDisabled={confirmValue !== dbName}
        />
    );
}
