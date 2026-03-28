'use client';

import { useState, useEffect } from 'react';
import { CommandSetForm } from '../../command-set-form';
import { updateCommandSet, getCommandSet, CommandSet, CommandSetCommand } from '../../actions';
import { Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

export default function EditCommandSetPage() {
    const params = useParams();
    const router = useRouter();

    // params.id might be string or string[], handle carefully. Using as string.
    const id = params.id as string;

    const [userId, setUserId] = useState<string | null>(null);
    const [commandSet, setCommandSet] = useState<CommandSet | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const tempUid = "tempaccount";
        setUserId(tempUid);

        // Fetch data
        if (id) {
            getCommandSet(id).then(data => {
                if (data) {
                    if (data.userId !== tempUid) {
                        setError("You do not have permission to edit this command set.");
                    } else {
                        setCommandSet(data);
                    }
                } else {
                    setError("Command set not found.");
                }
                setIsLoading(false);
            }).catch(err => {
                setError(err.message);
                setIsLoading(false);
            });
        }
    }, [id]);

    if (isLoading) {
        return <div className="flex items-center justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    if (error) {
        return <div className="p-20 text-center text-destructive font-medium">{error}</div>;
    }

    if (!userId || !commandSet) {
        return <div className="p-20 text-center">Something went wrong.</div>;
    }

    const handleSubmit = async (data: { name: string, description: string, commands: CommandSetCommand[] }) => {
        return await updateCommandSet(id, {
            name: data.name,
            description: data.description,
            commands: data.commands
        });
    };

    return (
        <div className="container py-8">
            <CommandSetForm
                userId={userId}
                initialData={commandSet}
                title="Edit Command Set"
                subtitle={`Modify "${commandSet.name}" details and steps.`}
                onSubmit={handleSubmit}
            />
        </div>
    );
}
