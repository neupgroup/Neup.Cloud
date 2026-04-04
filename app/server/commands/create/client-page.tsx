'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, PlusCircle, Trash2, Variable } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { PageTitleBack } from '@/components/page-header';

import { useToast } from '@/hooks/use-toast';
import { createSavedCommand } from '../actions';
import { VARIABLE_REGEX } from '../types';
import { serializeCommandSetCommands } from '@/services/command-sets/serialize';

type CreateMode = 'command' | 'set';

type StepDraft = {
  id: string;
  title: string;
  command: string;
  description: string;
  isSkippable: boolean;
  isRepeatable: boolean;
};

function emptyStep(id: string): StepDraft {
  return {
    id,
    title: '',
    command: '',
    description: '',
    isSkippable: false,
    isRepeatable: false,
  };
}

function extractVariablesFromText(text: string) {
  const matches = text.matchAll(VARIABLE_REGEX);
  return Array.from(matches, (match) => match[1]);
}

export default function CreateCommandPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);

  const mode = useMemo<CreateMode>(() => {
    return searchParams.get('mode') === 'set' ? 'set' : 'command';
  }, [searchParams]);

  useEffect(() => {
    const currentMode = searchParams.get('mode');
    if (currentMode !== 'command' && currentMode !== 'set') {
      router.replace('/server/commands/create?mode=command', { scroll: false });
    }
  }, [router, searchParams]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [commandBody, setCommandBody] = useState(
    '<<{{start.linux}}>>\n\n<<{{end.linux}}>>\n\n<<{{start.windows}}>>\n\n<<{{end.windows}}>>'
  );
  const [variableMeta, setVariableMeta] = useState<Record<string, { title?: string; description?: string; hint?: string }>>({});

  const stepCounter = useRef(1);
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep('step-1')]);

  const detectedVariables = useMemo(() => {
    if (mode === 'command') {
      return extractVariablesFromText(commandBody);
    }

    const stepVariables = steps.flatMap((step) => extractVariablesFromText(step.command));
    return Array.from(new Set(stepVariables));
  }, [commandBody, mode, steps]);

  const setMode = (nextMode: CreateMode) => {
    router.replace(`/server/commands/create?mode=${nextMode}`, { scroll: false });
  };

  const updateStep = (id: string, field: keyof StepDraft, value: string | boolean) => {
    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, [field]: value } : step)));
  };

  const addStep = () => {
    stepCounter.current += 1;
    setSteps((prev) => [...prev, emptyStep(`step-${stepCounter.current}`)]);
  };

  const removeStep = (id: string) => {
    setSteps((prev) => {
      if (prev.length === 1) {
        stepCounter.current = 1;
        return [emptyStep('step-1')];
      }
      return prev.filter((step) => step.id !== id);
    });
  };

  const submitCommand = async () => {
    if (!title.trim() || !commandBody.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Title and command are required.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const variables = detectedVariables.map((name) => ({
        name,
        title: variableMeta[name]?.title || name,
        description: variableMeta[name]?.description || '',
        hint: variableMeta[name]?.hint || '',
      }));

      await createSavedCommand({
        name: title.trim(),
        description: description.trim(),
        command: commandBody,
        nextCommands: [],
        variables,
      });

      toast({
        title: 'Command Created',
        description: `The command "${title.trim()}" has been saved successfully.`,
      });
      router.push('/server/commands');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to create command: ${error.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const submitCommandSet = async () => {
    if (!title.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Title is required.',
      });
      return;
    }

    if (steps.some((step) => !step.command.trim())) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Each step must have a command.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const serialized = serializeCommandSetCommands(
        steps.map((step, index) => ({
          id: step.id,
          title: step.title || `Command ${index + 1}`,
          command: step.command,
          description: step.description,
          order: index,
          isSkippable: step.isSkippable,
          isRepeatable: step.isRepeatable,
        }))
      );

      await createSavedCommand({
        name: title.trim(),
        description: description.trim(),
        command: serialized,
        nextCommands: [],
        variables: detectedVariables.map((name) => ({
          name,
          title: variableMeta[name]?.title || name,
          description: variableMeta[name]?.description || '',
          hint: variableMeta[name]?.hint || '',
        })),
      });

      toast({
        title: 'Command Set Created',
        description: `The command set "${title.trim()}" has been saved successfully.`,
      });
      router.push('/server/commands');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to create command set: ${error.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-6">
      <PageTitleBack
        title={mode === 'command' ? 'Create Command' : 'Create Command Set'}
        description="Fill in the fields below to continue."
        backHref="/server/commands"
      />

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="create-title">Title</Label>
          <Input
            id="create-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Restart Web Server"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="create-description">Description</Label>
          <Input
            id="create-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short description of what this does."
          />
        </div>
      </div>

      <div className="grid gap-3">
        <p className="text-sm font-medium text-muted-foreground">Select a command type:</p>
        <div className="flex gap-2">
          <Button type="button" variant={mode === 'command' ? 'default' : 'outline'} onClick={() => setMode('command')}>
            Individual Command
          </Button>
          <Button type="button" variant={mode === 'set' ? 'default' : 'outline'} onClick={() => setMode('set')}>
            Command Set
          </Button>
        </div>
      </div>

      {mode === 'command' ? (
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="command-body">Command</Label>
            <Textarea
              id="command-body"
              className="font-mono min-h-[180px]"
              value={commandBody}
              onChange={(e) => setCommandBody(e.target.value)}
              placeholder="<<{{start.linux}}>>&#10;sudo apt install {{[[appName]]}}&#10;<<{{end.linux}}>>"
            />
            <p className="text-xs text-muted-foreground">
              Use {'{{[[variable]]}}'} for dynamic fields and {'<<{{start/end.os}}>>'} for OS-specific blocks.
            </p>
          </div>

          {detectedVariables.length > 0 && (
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Variable className="h-4 w-4" />
                Command Variables
              </h3>

              {detectedVariables.map((name) => (
                <div key={name} className="space-y-3 rounded-md border bg-muted/40 p-3">
                  <p className="text-sm font-mono">{name}</p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <Input
                      placeholder="Field title"
                      value={variableMeta[name]?.title || ''}
                      onChange={(e) =>
                        setVariableMeta((prev) => ({
                          ...prev,
                          [name]: { ...prev[name], title: e.target.value },
                        }))
                      }
                    />
                    <Input
                      placeholder="Hint (optional)"
                      value={variableMeta[name]?.hint || ''}
                      onChange={(e) =>
                        setVariableMeta((prev) => ({
                          ...prev,
                          [name]: { ...prev[name], hint: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <Textarea
                    placeholder="Description (optional)"
                    rows={2}
                    value={variableMeta[name]?.description || ''}
                    onChange={(e) =>
                      setVariableMeta((prev) => ({
                        ...prev,
                        [name]: { ...prev[name], description: e.target.value },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          <h3 className="text-base font-semibold">Command Steps</h3>

          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={step.id} className="space-y-3 rounded-lg border p-4 bg-card">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Step {index + 1}</p>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeStep(step.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <Input
                  placeholder="Step title (optional)"
                  value={step.title}
                  onChange={(e) => updateStep(step.id, 'title', e.target.value)}
                />

                <Textarea
                  placeholder="Command"
                  className="font-mono min-h-[120px]"
                  value={step.command}
                  onChange={(e) => updateStep(step.id, 'command', e.target.value)}
                />

                <Textarea
                  placeholder="Step description (optional)"
                  rows={2}
                  value={step.description}
                  onChange={(e) => updateStep(step.id, 'description', e.target.value)}
                />

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`skippable-${step.id}`}
                      checked={step.isSkippable}
                      onCheckedChange={(value) => updateStep(step.id, 'isSkippable', Boolean(value))}
                    />
                    <Label htmlFor={`skippable-${step.id}`} className="text-sm font-normal">Allow Skipping</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`repeatable-${step.id}`}
                      checked={step.isRepeatable}
                      onCheckedChange={(value) => updateStep(step.id, 'isRepeatable', Boolean(value))}
                    />
                    <Label htmlFor={`repeatable-${step.id}`} className="text-sm font-normal">Allow Repeats</Label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Card
            className="border-dashed bg-muted/20 p-4 cursor-pointer transition-colors hover:bg-muted/40"
            onClick={addStep}
            role="button"
            tabIndex={0}
            onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                addStep();
              }
            }}
          >
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold">Add another step</p>
              <p className="text-xs text-muted-foreground">Append a new command to this set.</p>
            </div>
          </Card>

          {detectedVariables.length > 0 && (
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Variable className="h-4 w-4" />
                Command Variables
              </h3>

              <p className="text-sm text-muted-foreground">
                Use {'{{[[variable]]}}'} for custom values. System values like {'{{server.name}}'} and {'{{os.availableNetworkPort_random}}'} are resolved at run time.
              </p>

              {detectedVariables.map((name) => (
                <div key={name} className="space-y-3 rounded-md border bg-muted/40 p-3">
                  <p className="text-sm font-mono">{name}</p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <Input
                      placeholder="Field title"
                      value={variableMeta[name]?.title || ''}
                      onChange={(e) =>
                        setVariableMeta((prev) => ({
                          ...prev,
                          [name]: { ...prev[name], title: e.target.value },
                        }))
                      }
                    />
                    <Input
                      placeholder="Hint (optional)"
                      value={variableMeta[name]?.hint || ''}
                      onChange={(e) =>
                        setVariableMeta((prev) => ({
                          ...prev,
                          [name]: { ...prev[name], hint: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <Textarea
                    placeholder="Description (optional)"
                    rows={2}
                    value={variableMeta[name]?.description || ''}
                    onChange={(e) =>
                      setVariableMeta((prev) => ({
                        ...prev,
                        [name]: { ...prev[name], description: e.target.value },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-start gap-3">
        <Button variant="outline" asChild disabled={isSaving}>
          <Link href="/server/commands">Cancel</Link>
        </Button>
        <Button
          onClick={mode === 'command' ? submitCommand : submitCommandSet}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : mode === 'command' ? (
            'Create Command'
          ) : (
            'Create Command Set'
          )}
        </Button>
      </div>
    </div>
  );
}
