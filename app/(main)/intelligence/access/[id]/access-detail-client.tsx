'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Save, Trash2, Lock, Unlock, KeyRound, Copy, AlertCircle } from 'lucide-react';

import {
  deleteIntelligenceAccessAction,
  publishIntelligenceAccessAction,
  type PublishIntelligenceAccessActionState,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
}

const initialPublishState: PublishIntelligenceAccessActionState = {
  error: null,
  success: null,
  generatedAccessKey: null,
};

export default function AccessDetailClient({ accountId, access }: AccessDetailProps) {
  const [publishState, publishAction, isPublishing] = useActionState(publishIntelligenceAccessAction, initialPublishState);
  const [previousKey, setPreviousKey] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  // Parse details to show what will be published
  const prompt = access.details[0] || '';
  const modelBlocks = access.details.slice(1).filter((d) => d && d.includes('/'));

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
              <p className="text-sm">
                {access.status === 'unpublished' ? (
                  <span className="text-amber-600 font-semibold">Unpublished (No access key generated)</span>
                ) : (
                  <span className="text-emerald-600 font-semibold capitalize">{access.status}</span>
                )}
              </p>
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
          {prompt && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Prompt</p>
              <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-sm">
                {prompt}
              </div>
            </div>
          )}

          {modelBlocks.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Model Blocks</p>
              <div className="grid gap-2">
                {modelBlocks.map((block, index) => {
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

      {access.published && access.status !== 'unpublished' && (
        <Card className="border-emerald-300/30 bg-emerald-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline text-emerald-900">
              <Unlock className="h-5 w-5" />
              Access Published
            </CardTitle>
            <CardDescription className="text-emerald-800">
              This access record is published and active. The access key is encrypted and stored securely.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              To make changes, you can update the configuration and republish with a new key or the original key.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Access</CardTitle>
          <CardDescription>
            This removes the access record and its logs. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteIntelligenceAccessAction} className="flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="access_id" value={String(access.id)} />
            <Button type="submit" variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Access
            </Button>
            <Button variant="outline" asChild>
              <Link href="/intelligence/access">Back to Access</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
