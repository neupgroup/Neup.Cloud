'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, X, Loader2, ChevronLeft, ChevronDown, GripVertical } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useRouter } from 'next/navigation';
import { useToast } from '../../../hooks/use-toast';
import { CommandSet, CommandSetCommand } from './actions';
import { nanoid } from 'nanoid';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface CommandDraft {
    tempId: string;
    title: string;
    command: string;
    description: string;
    isSkippable?: boolean;
    isRepeatable?: boolean;
}

interface CommandSetFormProps {
    initialData?: CommandSet;
    userId: string;
    onSubmit: (data: { name: string, description: string, commands: CommandSetCommand[] }) => Promise<{ success: boolean, error?: string }>;
    title: string;
    subtitle: string;
    showHeader?: boolean;
    showMetaFields?: boolean;
    nameValue?: string;
    descriptionValue?: string;
    onNameChange?: (value: string) => void;
    onDescriptionChange?: (value: string) => void;
}

export function CommandSetForm({
    initialData,
    userId,
    onSubmit,
    title,
    subtitle,
    showHeader = true,
    showMetaFields = true,
    nameValue,
    descriptionValue,
    onNameChange,
    onDescriptionChange,
}: CommandSetFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [name, setName] = useState(initialData?.name || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [commandsDraft, setCommandsDraft] = useState<CommandDraft[]>(
        initialData?.commands?.map(c => ({
            tempId: c.id || nanoid(),
            title: c.title || '',
            command: c.command,
            description: c.description || '',
            isSkippable: c.isSkippable || false,
            isRepeatable: c.isRepeatable || false
        })) || [
            { tempId: nanoid(), title: '', command: '', description: '', isSkippable: false, isRepeatable: false }
        ]
    );
    const [isSubmitting, setIsSubmitting] = useState(false);

    const effectiveName = nameValue ?? name;
    const effectiveDescription = descriptionValue ?? description;

    const setEffectiveName = (value: string) => {
        if (onNameChange) {
            onNameChange(value);
            return;
        }
        setName(value);
    };

    const setEffectiveDescription = (value: string) => {
        if (onDescriptionChange) {
            onDescriptionChange(value);
            return;
        }
        setDescription(value);
    };

    // Accordion state
    const [openDraftId, setOpenDraftId] = useState<string | null>(commandsDraft[0]?.tempId || null);

    // Drag and Drop state
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const handleAddDraftCommand = () => {
        const newId = nanoid();
        setCommandsDraft([...commandsDraft, { tempId: newId, title: '', command: '', description: '', isSkippable: false, isRepeatable: false }]);
        setOpenDraftId(newId); // Auto-open new draft
    };

    const handleRemoveDraftCommand = (id: string) => {
        if (commandsDraft.length === 1) {
            const newId = nanoid();
            setCommandsDraft([{ tempId: newId, title: '', command: '', description: '', isSkippable: false, isRepeatable: false }]);
            setOpenDraftId(newId);
            return;
        }
        setCommandsDraft(prev => prev.filter(c => c.tempId !== id));
        if (openDraftId === id) {
            setOpenDraftId(null);
        }
    };

    const handleDraftChange = (id: string, field: 'title' | 'command' | 'description', value: string) => {
        setCommandsDraft(commandsDraft.map(c =>
            c.tempId === id ? { ...c, [field]: value } : c
        ));
    };

    const handleDraftCheckboxChange = (id: string, field: 'isSkippable' | 'isRepeatable', value: boolean) => {
        setCommandsDraft(commandsDraft.map(c =>
            c.tempId === id ? { ...c, [field]: value } : c
        ));
    }

    // Drag Handlers
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        // Required for Firefox
        e.dataTransfer.effectAllowed = 'move';
        // Hide the default drag ghost slightly if we wanted customized preview, but standard is fine
        // e.dataTransfer.setDragImage(e.currentTarget as Element, 20, 20);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';

        if (draggedIndex === null || draggedIndex === index) return;

        // Swap logic
        const newDrafts = [...commandsDraft];
        const draggedItem = newDrafts[draggedIndex];

        // Remove from old pos
        newDrafts.splice(draggedIndex, 1);
        // Insert at new pos
        newDrafts.splice(index, 0, draggedItem);

        setCommandsDraft(newDrafts);
        setDraggedIndex(index); // Update dragged index to follow current position
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const handleSubmit = async () => {
        if (!effectiveName.trim()) {
            toast({ variant: "destructive", title: "Name required", description: "Please give your command set a name." });
            return;
        }
        if (commandsDraft.some(c => !c.command.trim())) {
            toast({ variant: "destructive", title: "Commands required", description: "All command steps must have a command." });
            return;
        }

        setIsSubmitting(true);

        const commands: CommandSetCommand[] = commandsDraft.map((d, index) => ({
            id: d.tempId,
            title: d.title || `Command ${index + 1}`,
            command: d.command,
            description: d.description,
            order: index,
            isSkippable: d.isSkippable,
            isRepeatable: d.isRepeatable
        }));

        const result = await onSubmit({
            name: effectiveName,
            description: effectiveDescription,
            commands
        });

        if (result.success) {
            toast({ title: "Success", description: "Command set saved successfully." });
            router.push('/commands/set');
            router.refresh();
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
            setIsSubmitting(false);
        }
    };

    const toggleDraft = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setOpenDraftId(current => current === id ? null : id);
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {showHeader && (
                <div className="flex flex-col gap-4 mb-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-fit -ml-2 text-muted-foreground hover:text-foreground"
                        onClick={() => router.back()}
                    >
                        <ChevronLeft className="mr-1 h-4 w-4" /> Back to Command Set
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                        <p className="text-muted-foreground mt-1">{subtitle}</p>
                    </div>
                </div>
            )}

            <div className="grid gap-6">
                {/* Meta Information */}
                {showMetaFields && (
                    <Card className="p-6 space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Title</Label>
                            <Input
                                id="name"
                                placeholder="e.g. Server Setup Script"
                                value={effectiveName}
                                onChange={(e) => setEffectiveName(e.target.value)}
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="desc">Description</Label>
                            <Input
                                id="desc"
                                placeholder="A short description of what this command set does."
                                value={effectiveDescription}
                                onChange={(e) => setEffectiveDescription(e.target.value)}
                                disabled={isSubmitting}
                            />
                        </div>
                    </Card>
                )}

                <div className="space-y-4 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                        <Label className="text-lg">Commands Sequence</Label>
                        <Button size="sm" variant="secondary" onClick={handleAddDraftCommand} disabled={isSubmitting} className="w-full sm:w-auto">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Step
                        </Button>
                    </div>

                    <div className="space-y-3 relative">
                        {commandsDraft.map((draft, idx) => {
                            const isOpen = openDraftId === draft.tempId;
                            const isDragging = draggedIndex === idx;

                            return (
                                <div
                                    key={draft.tempId}
                                    draggable={!isSubmitting}
                                    onDragStart={(e) => handleDragStart(e, idx)}
                                    onDragOver={(e) => handleDragOver(e, idx)}
                                    onDragEnd={handleDragEnd}
                                    className={cn(
                                        "border rounded-lg bg-card shadow-sm transition-all duration-200",
                                        isOpen ? "ring-1 ring-primary/20" : "hover:border-primary/20",
                                        isDragging && "opacity-50 ring-2 ring-primary border-dashed z-20"
                                    )}
                                >
                                    {/* Header (Always Visible) */}
                                    <div
                                        className="flex items-start p-4 cursor-pointer select-none relative gap-3"
                                        onClick={() => toggleDraft(draft.tempId)}
                                    >
                                        {/* Drag Handle */}
                                        <div className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground transition-colors pt-1">
                                            <GripVertical className="h-5 w-5" />
                                        </div>

                                        <div className="flex-1 min-w-0 grid gap-1.5">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-[10px] font-semibold shrink-0">
                                                    {idx + 1}
                                                </div>
                                                <span className={cn("font-medium break-words whitespace-normal", !draft.title && "text-muted-foreground italic")}>
                                                    {draft.title || `Command step ${idx + 1}`}
                                                </span>
                                                {/* Preview Flags */}
                                                {(draft.isSkippable || draft.isRepeatable) && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {draft.isSkippable && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">Optional</span>}
                                                        {draft.isRepeatable && <span className="text-[10px] border px-1.5 py-0.5 rounded text-muted-foreground">Repeats</span>}
                                                    </div>
                                                )}
                                            </div>
                                            {!isOpen && (
                                                <p className="text-xs text-muted-foreground font-mono opacity-75 line-clamp-2 break-all whitespace-pre-wrap pl-7">
                                                    {draft.command || "No command entered"}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={(e) => { e.stopPropagation(); handleRemoveDraftCommand(draft.tempId); }}
                                                disabled={isSubmitting}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>

                                            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
                                        </div>
                                    </div>

                                    {/* Expanded Edit Form */}
                                    {isOpen && (
                                        <div className="p-4 pt-0 border-t bg-muted/5 animate-in slide-in-from-top-1 duration-200">
                                            <div className="grid gap-4 mt-4">
                                                <div className="grid gap-2">
                                                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Title</Label>
                                                    <Input
                                                        placeholder="Step Title (e.g. Update System)"
                                                        value={draft.title}
                                                        onChange={(e) => handleDraftChange(draft.tempId, 'title', e.target.value)}
                                                        className="font-semibold"
                                                        disabled={isSubmitting}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Command</Label>
                                                    <Textarea
                                                        placeholder="Shell command (e.g. apt-get update)"
                                                        value={draft.command}
                                                        onChange={(e) => handleDraftChange(draft.tempId, 'command', e.target.value)}
                                                        className="font-mono text-sm min-h-[120px]"
                                                        disabled={isSubmitting}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Description</Label>
                                                    <Textarea
                                                        placeholder="Description (optional)"
                                                        value={draft.description}
                                                        onChange={(e) => handleDraftChange(draft.tempId, 'description', e.target.value)}
                                                        className="text-xs min-h-[80px] text-muted-foreground"
                                                        disabled={isSubmitting}
                                                    />
                                                    <p className="text-[10px] text-muted-foreground">Supported: &lt;b&gt;, &lt;i&gt;, &lt;u&gt;, &lt;a href="/"&gt; (internal only), new lines</p>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-6 pt-2 pb-2">
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`skip-${draft.tempId}`}
                                                            checked={draft.isSkippable}
                                                            onCheckedChange={(c) => handleDraftCheckboxChange(draft.tempId, 'isSkippable', c as boolean)}
                                                            disabled={isSubmitting}
                                                        />
                                                        <Label htmlFor={`skip-${draft.tempId}`} className="text-sm font-normal text-muted-foreground cursor-pointer">Allow Skipping</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`repeat-${draft.tempId}`}
                                                            checked={draft.isRepeatable}
                                                            onCheckedChange={(c) => handleDraftCheckboxChange(draft.tempId, 'isRepeatable', c as boolean)}
                                                            disabled={isSubmitting}
                                                        />
                                                        <Label htmlFor={`repeat-${draft.tempId}`} className="text-sm font-normal text-muted-foreground cursor-pointer">Allow Repeats</Label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-center pt-2">
                        <Button variant="outline" className="w-full border-dashed" onClick={handleAddDraftCommand} disabled={isSubmitting}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Another Command Step
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex gap-3 pt-6 border-t">
                    <Button variant="outline" onClick={() => router.back()} disabled={isSubmitting} className="flex-1">
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {initialData ? 'Save Changes' : 'Create Command Set'}
                    </Button>
                </div>
        </div>
    );
}
