'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Save, Trash2, Lock, Unlock, KeyRound, Copy, AlertCircle, Edit, Plus, Trash } from 'lucide-react';

import {
  deleteIntelligenceAccessAction,
  publishIntelligenceAccessAction,
  updateIntelligenceAccessConfigAction,
  updateIntelligenceAccessStatusAction,
  resetIntelligenceAccessKeyAction,
  type PublishIntelligenceAccessActionState,
  type UpdateIntelligenceAccessConfigActionState,
  type UpdateIntelligenceAccessStatusActionState,
  type ResetIntelligenceAccessKeyActionState,
} from '@/services/intelligence/intelligence-service';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TokenOption {
  id: number;
  account_id: string;
  name: string;
}

interface ModelOption {
  id: number;
  title: string;
  provider: string;
  model: string;
  description: string | null;
}

interface AccessDetailProps {
  accountId: string;
  access: {
    id: string;
    keyHash: string;
    type: string;
    status: string;
    maxTokens: number | null;
    tokenBalance: number;
    details: string[];
    published: boolean;
  };
  tokens: TokenOption[];
  models: ModelOption[];
}

const initialPublishState: PublishIntelligenceAccessActionState = {
  error: null,
  success: null,
  generatedAccessKey: null,
};

const initialStatusState: UpdateIntelligenceAccessStatusActionState = {
  error: null,
  success: null,
};

const initialConfigState: UpdateIntelligenceAccessConfigActionState = {
  error: null,
  success: null,
};

const initialResetKeyState: ResetIntelligenceAccessKeyActionState = {
  error: null,
  success: null,
  generatedAccessKey: null,
};

export default function AccessDetailClient({ accountId, access, tokens, models }: AccessDetailProps) {
  const [publishState, publishAction, isPublishing] = useActionState(publishIntelligenceAccessAction, initialPublishState);
  const [statusState, statusAction, isUpdatingStatus] = useActionState(updateIntelligenceAccessStatusAction, initialStatusState);
  const [configState, configAction, isUpdatingConfig] = useActionState(updateIntelligenceAccessConfigAction, initialConfigState);
  const [resetKeyState, resetKeyAction, isResettingKey] = useActionState(resetIntelligenceAccessKeyAction, initialResetKeyState);
  const [previousKey, setPreviousKey] = useState('');
  const [accessKeyForEdit, setAccessKeyForEdit] = useState('');
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testAccessKey, setTestAccessKey] = useState('');
  const [testPrompt, setTestPrompt] = useState('');
  const [testContext, setTestContext] = useState('');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Parse existing details
  const existingPrompt = access.type === 'closed' ? (access.details[0] || '') : '';
  const existingModelBlocks = access.details.slice(access.type === 'closed' ? 1 : 1).filter((d) => d && d.includes('/')).map((block) => {
    const parts = block.split('/');
    return {
      provider: parts[0] || '',
      model: parts[1] || '',
      encrypted: parts[2] || '0',
      tokenId: parts[3] || '0',
    };
  });

  const [editPrompt, setEditPrompt] = useState(existingPrompt);
  const [editMaxTokens, setEditMaxTokens] = useState(access.maxTokens?.toString() || '');
  const [editModelBlocks, setEditModelBlocks] = useState(existingModelBlocks.map((block) => {
    const model = models.find((m) => m.provider === block.provider && m.model === block.model);
    return {
      modelId: model?.id.toString() || '',
      tokenId: block.tokenId !== '0' ? block.tokenId : '',
    };
  }));

  // For display purposes
  const displayPrompt = existingPrompt;
  const displayModelBlocks = access.details.slice(access.type === 'closed' ? 1 : 1).filter((d) => d && d.includes('/'));

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (accessKey: string, accessId: string) => {
    const blob = new Blob([accessKey], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-token-${accessId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateCurlCommand = () => {
    const baseUrl = window.location.origin;
    let curlCommand = `curl -X POST ${baseUrl}/bridge/api.v1/intelligence/getResponse \\\n`;
    curlCommand += `  -H "Content-Type: application/json" \\\n`;
    curlCommand += `  -d '{\n`;
    curlCommand += `    "accessId": "${access.id}",\n`;
    curlCommand += `    "accessKey": "${testAccessKey || 'YOUR_ACCESS_KEY'}",\n`;
    
    if (access.type === 'hybrid') {
      curlCommand += `    "prompt": "${testPrompt || 'YOUR_PROMPT'}",\n`;
    }
    
    curlCommand += `    "context": "${testContext || 'YOUR_CONTEXT'}"\n`;
    curlCommand += `  }'`;
    
    return curlCommand;
  };

  const handleTest = async () => {
    setTestLoading(true);
    setTestError(null);
    setTestResponse(null);

    try {
      const baseUrl = window.location.origin;
      const body: Record<string, string> = {
        accessId: access.id,
        accessKey: testAccessKey,
        context: testContext,
      };

      if (access.type === 'hybrid') {
        body.prompt = testPrompt;
      }

      const response = await fetch(`${baseUrl}/bridge/api.v1/intelligence/getResponse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setTestError(data.error || `HTTP ${response.status}: ${response.statusText}`);
      } else {
        setTestResponse(JSON.stringify(data, null, 2));
      }
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setTestLoading(false);
    }
  };

  const handleStatusClick = async () => {
    // Only allow status change for published access
    if (access.status === 'unpublished' || !access.published) {
      return;
    }

    // Cycle through statuses: prod -> dev -> hold -> prod
    const statusCycle: Record<string, 'dev' | 'prod' | 'hold'> = {
      prod: 'dev',
      dev: 'hold',
      hold: 'prod',
    };

    const newStatus = statusCycle[access.status] || 'prod';

    // Create a FormData and submit the status change
    const formData = new FormData();
    formData.append('access_id', String(access.id));
    formData.append('status', newStatus);

    await statusAction(formData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'dev':
        return 'text-blue-600';
      case 'prod':
        return 'text-emerald-600';
      case 'hold':
        return 'text-red-600';
      case 'unpublished':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'unpublished':
        return 'Unpublished (No access key generated)';
      case 'prod':
        return 'Production';
      case 'dev':
        return 'Development';
      case 'hold':
        return 'Hold';
      default:
        return status;
    }
  };

  return (
    <div className="grid gap-6">
      {publishState.generatedAccessKey && (
        <Card className="border-emerald-300/60 bg-emerald-50/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline text-emerald-900">
              <KeyRound className="h-5 w-5" />
              Save This Access Key Now
            </CardTitle>
            <CardDescription className="text-emerald-800">
              The access key is shown only once. Copy it now and store it safely. Only the hash was saved to the database.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <button
              type="button"
              onClick={() => handleCopy(publishState.generatedAccessKey!)}
              className="rounded-xl border border-emerald-300 bg-white p-4 text-left font-mono text-sm break-all text-emerald-950 transition hover:border-emerald-500 hover:bg-emerald-100"
            >
              {publishState.generatedAccessKey}
            </button>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" onClick={() => handleCopy(publishState.generatedAccessKey!)}>
                <Copy className="mr-2 h-4 w-4" />
                {copied ? 'Copied' : 'Copy Access Key'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {publishState.error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {publishState.error}
        </div>
      )}

      {publishState.success && !publishState.generatedAccessKey && (
        <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-4 text-sm text-emerald-900">
          {publishState.success}
        </div>
      )}

      {statusState.error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {statusState.error}
        </div>
      )}

      {statusState.success && (
        <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-4 text-sm text-emerald-900">
          {statusState.success}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <AlertCircle className="h-5 w-5 text-primary" />
            Access Status
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Access ID</p>
              <p className="font-mono text-sm">{access.id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Type</p>
              <p className="text-sm">{access.type}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <button
                type="button"
                onClick={handleStatusClick}
                disabled={access.status === 'unpublished' || !access.published || isUpdatingStatus}
                className={`text-sm font-semibold ${getStatusColor(access.status)} ${
                  access.status !== 'unpublished' && access.published
                    ? 'cursor-pointer hover:underline'
                    : 'cursor-not-allowed'
                } disabled:opacity-50`}
              >
                {getStatusLabel(access.status)}
              </button>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Token Balance</p>
              <p className="text-sm">{access.tokenBalance.toFixed(6)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Configuration Details</CardTitle>
          <CardDescription>View the configuration for this access record</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {access.type === 'closed' && displayPrompt && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Prompt</p>
              <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-sm">
                {displayPrompt}
              </div>
            </div>
          )}

          {displayModelBlocks.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Model Blocks</p>
              <div className="grid gap-2">
                {displayModelBlocks.map((block, index) => {
                  const parts = block.split('/');
                  const isUnpublished = parts[2] === '0';
                  return (
                    <div key={index} className="rounded-xl border border-border/70 bg-background p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {index === 0 ? 'Primary' : `Fallback ${index}`}
                      </p>
                      <p className="font-mono text-sm">
                        {parts[0]}/{parts[1]}
                        {isUnpublished ? (
                          <span className="ml-2 text-amber-600">(Unpublished - Token ID: {parts[3]})</span>
                        ) : (
                          <span className="ml-2 text-emerald-600">(Published)</span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {configState.error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {configState.error}
        </div>
      )}

      {configState.success && (
        <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-4 text-sm text-emerald-900">
          {configState.success}
        </div>
      )}

      {access.published && access.status !== 'unpublished' && isEditing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <Edit className="h-5 w-5 text-primary" />
              Edit Configuration
            </CardTitle>
            <CardDescription>
              Modify the configuration. Requires access key for verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resetKeyState.generatedAccessKey && (
              <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50/80 p-5">
                <div className="flex items-start gap-3 mb-3">
                  <KeyRound className="h-6 w-6 text-emerald-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-base font-bold text-emerald-900 mb-1">New Access Key Generated</p>
                    <p className="text-sm text-emerald-800 leading-relaxed">
                      This key can only be copied or downloaded just this time. This is shown just once - if you refresh the page, it's gone. 
                      It's not even stored on the server, so keep it confidential and download or save it in a secure place.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(resetKeyState.generatedAccessKey!)}
                  className="w-full rounded-xl border-2 border-emerald-400 bg-white p-4 text-left font-mono text-sm break-all text-emerald-950 transition hover:border-emerald-600 hover:bg-emerald-50 mb-3"
                >
                  {resetKeyState.generatedAccessKey}
                </button>
                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    onClick={() => handleCopy(resetKeyState.generatedAccessKey!)}
                    className="flex-1"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {copied ? 'Copied!' : 'Copy Key'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => handleDownload(resetKeyState.generatedAccessKey!, access.id)}
                    className="flex-1"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Download Key
                  </Button>
                </div>
              </div>
            )}

            {configState.error && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {configState.error}
              </div>
            )}

            {configState.success && (
              <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                {configState.success}
              </div>
            )}

            {resetKeyState.error && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {resetKeyState.error}
              </div>
            )}

            {resetKeyState.success && (
              <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                {resetKeyState.success}
              </div>
            )}

            <form action={configAction} className="grid gap-4">
              <input type="hidden" name="access_id" value={String(access.id)} />

              {access.type === 'closed' && (
                <div className="grid gap-2">
                  <Label htmlFor="edit_prompt">Prompt</Label>
                  <Textarea
                    id="edit_prompt"
                    name="prompt"
                    className="min-h-32"
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Enter the prompt"
                  />
                </div>
              )}

              {(access.type === 'hybrid' || access.type === 'closed') && (
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Model Blocks</p>
                        <p className="text-sm text-muted-foreground">Configure models for this access</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditModelBlocks([...editModelBlocks, { modelId: '', tokenId: '' }])}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Block
                      </Button>
                    </div>

                    {editModelBlocks.map((block, index) => (
                      <div key={index} className="grid gap-4 rounded-2xl border border-border/70 bg-background p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">
                              {index === 0 ? 'Primary model block' : `Fallback block ${index}`}
                            </p>
                          </div>
                          {index > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditModelBlocks(editModelBlocks.filter((_, i) => i !== index))}
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Remove
                            </Button>
                          )}
                        </div>

                        <div className="grid gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor={`model_${index}_id`}>Model</Label>
                            <input type="hidden" name={`model_${index}_id`} value={block.modelId} />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" className="justify-between">
                                  <span className="truncate">
                                    {block.modelId
                                      ? models.find((m) => m.id === Number(block.modelId))?.title || 'Select a model'
                                      : 'Select a model'}
                                  </span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="max-h-72 w-96 overflow-auto">
                                {models.map((model) => (
                                  <DropdownMenuItem
                                    key={model.id}
                                    onClick={() => {
                                      const newBlocks = [...editModelBlocks];
                                      newBlocks[index].modelId = String(model.id);
                                      setEditModelBlocks(newBlocks);
                                    }}
                                  >
                                    {model.title} ({model.provider}:{model.model})
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {access.type === 'closed' && (
                            <div className="grid gap-2">
                              <Label htmlFor={`token_${index}_id`}>Token</Label>
                              <input type="hidden" name={`token_${index}_id`} value={block.tokenId} />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button type="button" variant="outline" className="justify-between" disabled={!block.modelId}>
                                    <span className="truncate">
                                      {block.tokenId
                                        ? tokens.find((t) => t.id === Number(block.tokenId))?.name || 'Select a token'
                                        : 'Select a token'}
                                    </span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="max-h-72 w-96 overflow-auto">
                                  {tokens.map((token) => (
                                    <DropdownMenuItem
                                      key={token.id}
                                      onClick={() => {
                                        const newBlocks = [...editModelBlocks];
                                        newBlocks[index].tokenId = String(token.id);
                                        setEditModelBlocks(newBlocks);
                                      }}
                                    >
                                      {token.name}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="edit_max_tokens">Max Tokens (optional)</Label>
                  <Input
                    id="edit_max_tokens"
                    name="max_tokens"
                    type="number"
                    min="1"
                    value={editMaxTokens}
                    onChange={(e) => setEditMaxTokens(e.target.value)}
                    placeholder="Optional"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="access_key_edit">Access Key (required for verification)</Label>
                  <Input
                    id="access_key_edit"
                    name="access_key"
                    type="password"
                    value={accessKeyForEdit}
                    onChange={(e) => setAccessKeyForEdit(e.target.value)}
                    placeholder="Enter your access key"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Your access key is required to verify your identity and re-encrypt any API keys
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={isUpdatingConfig || !accessKeyForEdit}>
                    <Save className="mr-2 h-4 w-4" />
                    {isUpdatingConfig ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setAccessKeyForEdit('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>

              <div className="pt-4 border-t">
                <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 p-4 mb-4">
                  <p className="text-sm font-semibold text-amber-900 mb-2">Lost Your Access Key?</p>
                  <p className="text-sm text-amber-800">
                    Reset your access key if you've lost it. This will generate a new key, set status to unpublished, 
                    and reset all encrypted API keys. You'll need to publish again with the new key.
                  </p>
                </div>
                <form action={resetKeyAction}>
                  <input type="hidden" name="access_id" value={String(access.id)} />
                  <Button 
                    type="submit" 
                    variant="destructive" 
                    disabled={isResettingKey}
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    {isResettingKey ? 'Resetting...' : 'Reset Key'}
                  </Button>
                </form>
              </div>
          </CardContent>
        </Card>
      )}

      {!access.published && access.status === 'unpublished' && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <Lock className="h-5 w-5 text-primary" />
              Publish Access
            </CardTitle>
            <CardDescription>
              Generate an access key to make this access record active. Choose to create a new key or keep the original.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="new" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="new">Reset & Publish with New Key</TabsTrigger>
                <TabsTrigger value="original">Publish with Original Key</TabsTrigger>
              </TabsList>

              <TabsContent value="new" className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This will generate a new random access key, encrypt the API keys, and set the status to production.
                </p>
                <form action={publishAction}>
                  <input type="hidden" name="access_id" value={String(access.id)} />
                  <input type="hidden" name="reset_key" value="true" />
                  <input type="hidden" name="new_access_key" value="" />
                  <Button type="submit" disabled={isPublishing}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    {isPublishing ? 'Publishing...' : 'Generate New Key & Publish'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="original" className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter the original access key to verify and publish with the same key.
                </p>
                <form action={publishAction} className="grid gap-4">
                  <input type="hidden" name="access_id" value={String(access.id)} />
                  <input type="hidden" name="reset_key" value="false" />
                  <div className="grid gap-2">
                    <Label htmlFor="previous_key">Previous Access Key</Label>
                    <Input
                      id="previous_key"
                      name="previous_key"
                      type="password"
                      value={previousKey}
                      onChange={(e) => setPreviousKey(e.target.value)}
                      placeholder="Enter the original access key"
                      required
                    />
                  </div>
                  <input type="hidden" name="new_access_key" value={previousKey} />
                  <Button type="submit" disabled={isPublishing || !previousKey}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    {isPublishing ? 'Publishing...' : 'Verify & Publish'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Test Section */}
      {isTesting && access.type !== 'open' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <AlertCircle className="h-5 w-5 text-primary" />
              Test Intelligence Access
            </CardTitle>
            <CardDescription>
              Test your intelligence access endpoint with sample data. Values are not stored.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Curl Command Display */}
            <div>
              <Label className="mb-2 block">cURL Command</Label>
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all text-foreground">
                  {generateCurlCommand()}
                </pre>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopy(generateCurlCommand())}
                className="mt-2"
              >
                <Copy className="mr-2 h-4 w-4" />
                {copied ? 'Copied!' : 'Copy cURL'}
              </Button>
            </div>

            {/* Test Form */}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="test_access_key">Access Key *</Label>
                <Input
                  id="test_access_key"
                  type="password"
                  value={testAccessKey}
                  onChange={(e) => setTestAccessKey(e.target.value)}
                  placeholder="Enter your access key"
                />
              </div>

              {access.type === 'hybrid' && (
                <div className="grid gap-2">
                  <Label htmlFor="test_prompt">Prompt *</Label>
                  <Textarea
                    id="test_prompt"
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    placeholder="Enter your prompt"
                    className="min-h-24"
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="test_context">Context *</Label>
                <Textarea
                  id="test_context"
                  value={testContext}
                  onChange={(e) => setTestContext(e.target.value)}
                  placeholder="Enter your context or question"
                  className="min-h-32"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={handleTest}
                  disabled={testLoading || !testAccessKey || !testContext || (access.type === 'hybrid' && !testPrompt)}
                >
                  {testLoading ? 'Testing...' : 'Run Test'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsTesting(false);
                    setTestAccessKey('');
                    setTestPrompt('');
                    setTestContext('');
                    setTestResponse(null);
                    setTestError(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>

            {/* Response Display */}
            {testError && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
                <p className="text-sm font-semibold text-destructive mb-2">Error</p>
                <pre className="text-xs font-mono whitespace-pre-wrap break-all text-destructive">
                  {testError}
                </pre>
              </div>
            )}

            {testResponse && (
              <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-4">
                <p className="text-sm font-semibold text-emerald-900 mb-2">Response</p>
                <pre className="text-xs font-mono whitespace-pre-wrap break-all text-emerald-950">
                  {testResponse}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {!isEditing && (
        <div className="flex gap-3">
          {access.published && access.status !== 'unpublished' && access.type !== 'open' && (
            <Button onClick={() => setIsTesting(true)} variant="outline" disabled={isTesting}>
              <AlertCircle className="mr-2 h-4 w-4" />
              Test
            </Button>
          )}
          
          {access.published && access.status !== 'unpublished' && (
            <Button onClick={() => setIsEditing(true)} variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          
          <form action={deleteIntelligenceAccessAction} className="inline">
            <input type="hidden" name="access_id" value={String(access.id)} />
            <Button type="submit" variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
