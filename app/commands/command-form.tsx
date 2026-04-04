'use client';

import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Variable } from 'lucide-react';
import { CommandFormData, VARIABLE_REGEX } from './types';

type CommandFormProps = {
    formData: CommandFormData;
    onFormDataChange: (field: keyof Omit<CommandFormData, 'variables'>, value: string) => void;
    onVariableDataChange: (varName: string, field: 'title' | 'description' | 'hint', value: string) => void;
    showMetaFields?: boolean;
};

export function CommandForm({ formData, onFormDataChange, onVariableDataChange, showMetaFields = true }: CommandFormProps) {
    const detectedVariables = useMemo(() => {
        const matches = formData.command.matchAll(VARIABLE_REGEX);
        return Array.from(matches, m => m[1]);
    }, [formData.command]);

    return (
        <div className="grid gap-6">
            {showMetaFields && (
                <div className="grid gap-2">
                    <Label htmlFor="command-name">Title</Label>
                    <Input
                        id="command-name"
                        value={formData.name}
                        onChange={(e) => onFormDataChange('name', e.target.value)}
                        placeholder="e.g., 'Restart Web Server'"
                    />
                </div>
            )}

            <div className="grid gap-2">
                <Label htmlFor="command-script">Command</Label>
                <Textarea
                    id="command-script"
                    value={formData.command}
                    onChange={(e) => onFormDataChange('command', e.target.value)}
                    placeholder="<<{{start.linux}}>>&#10;sudo apt install {{[[appName]]}}&#10;<<{{end.linux}}>>"
                    className="font-mono h-32"
                />
                <p className="text-xs text-muted-foreground">
                    Use {`{{[[variable]]}}`} for dynamic fields and {`<<{{start/end.os}}>>`} for OS-specific blocks.
                </p>
            </div>

            {showMetaFields && (
                <div className="grid gap-2">
                    <Label htmlFor="command-desc">Description</Label>
                    <Input
                        id="command-desc"
                        value={formData.description}
                        onChange={(e) => onFormDataChange('description', e.target.value)}
                        placeholder="A short description of what this command does."
                    />
                </div>
            )}



            {detectedVariables.length > 0 && (
                <div className="space-y-4 rounded-lg border p-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Variable className="h-5 w-5" />
                        Command Variables
                    </h3>
                    {detectedVariables.map(varName => (
                        <div key={varName} className="space-y-4 rounded-md border bg-muted/50 p-4">
                            <p className="font-mono text-sm font-semibold">{varName}</p>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor={`var-title-${varName}`}>Field Title</Label>
                                    <Input
                                        id={`var-title-${varName}`}
                                        value={formData.variables[varName]?.title || ''}
                                        onChange={e => onVariableDataChange(varName, 'title', e.target.value)}
                                        placeholder="e.g., Application Name"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor={`var-hint-${varName}`}>Hint (Optional)</Label>
                                    <Input
                                        id={`var-hint-${varName}`}
                                        value={formData.variables[varName]?.hint || ''}
                                        onChange={e => onVariableDataChange(varName, 'hint', e.target.value)}
                                        placeholder="e.g., my-app"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={`var-desc-${varName}`}>Description (Optional)</Label>
                                <Textarea
                                    id={`var-desc-${varName}`}
                                    value={formData.variables[varName]?.description || ''}
                                    onChange={e => onVariableDataChange(varName, 'description', e.target.value)}
                                    placeholder="Describe what this value is for."
                                    rows={2}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
