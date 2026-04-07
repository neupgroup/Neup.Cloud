'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { updateServer } from '@/app/servers/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type Props = {
    serverId: string;
    initialSwapSize: number;
    initialMoreDetails: string;
};

function buildMoreDetails(existingMoreDetails: string, swapSizeMb: number) {
    const normalizedSwapSizeMb = Number.isFinite(swapSizeMb) ? Math.max(1, Math.floor(swapSizeMb)) : 2048;

    try {
        const parsed = existingMoreDetails ? JSON.parse(existingMoreDetails) : {};
        return JSON.stringify({
            ...parsed,
            swapSizeMb: normalizedSwapSizeMb,
        });
    } catch {
        return JSON.stringify({ swapSizeMb: normalizedSwapSizeMb });
    }
}

export default function SwapperClient({ serverId, initialSwapSize, initialMoreDetails }: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const [swapSize, setSwapSize] = useState(initialSwapSize);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSaving(true);

        try {
            await updateServer(serverId, {
                moreDetails: buildMoreDetails(initialMoreDetails, swapSize),
            });

            toast({
                title: 'Swap Updated',
                description: `Swap size saved as ${Math.max(1, Math.floor(swapSize || 2048))} MB.`,
            });
            router.refresh();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: error?.message || 'Failed to save swap configuration.',
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <div className="grid gap-2 max-w-sm">
                <Label htmlFor="swapSize">Swap Size (MB)</Label>
                <Input
                    id="swapSize"
                    type="number"
                    min={1}
                    step={1}
                    value={swapSize}
                    onChange={(event) => setSwapSize(Number(event.target.value))}
                    placeholder="2048"
                />
                <p className="text-xs text-muted-foreground">
                    Enter the swap size in megabytes. This setting is read by the SSH runner for command execution.
                </p>
            </div>

            <div className="flex items-center justify-end gap-3 border-t pt-4">
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Swap Space'}
                </Button>
            </div>
        </form>
    );
}