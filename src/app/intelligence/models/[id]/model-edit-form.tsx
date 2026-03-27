'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Save, Trash2 } from 'lucide-react';

import {
  deleteIntelligenceModelAction,
  updateIntelligenceModelAction,
  type UpdateIntelligenceModelActionState,
} from '@/app/intelligence/actions';
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

const initialState: UpdateIntelligenceModelActionState = {
  error: null,
  success: null,
};

export default function ModelEditForm({
  modelId,
  initialValues,
}: {
  modelId: number;
  initialValues: {
    title: string;
    provider: string;
    model: string;
    description: string | null;
    price: Record<string, unknown>;
  };
}) {
  const [state, updateAction, isPending] = useActionState(updateIntelligenceModelAction, initialState);

  return (
    <div className="grid gap-6">
      {state.error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-4 text-sm text-emerald-900">
          {state.success}
        </div>
      )}

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-headline">Edit model</CardTitle>
          <CardDescription className="max-w-2xl text-base">
            Update the provider, model name, description, and pricing JSON. Existing access records keep their own copied snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateAction} className="grid gap-5">
            <input type="hidden" name="model_id" value={String(modelId)} />

            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" defaultValue={initialValues.title} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="provider">Provider</Label>
                <select
                  id="provider"
                  name="provider"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  defaultValue={initialValues.provider}
                >
                  <option value="openai">openai</option>
                  <option value="anthropic">anthropic</option>
                  <option value="google">google</option>
                </select>
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="model">Model</Label>
                <Input id="model" name="model" defaultValue={initialValues.model} required />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={initialValues.description || ''}
                className="min-h-24"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="price">Price JSON</Label>
              <Textarea
                id="price"
                name="price"
                defaultValue={JSON.stringify(initialValues.price, null, 2)}
                className="min-h-40 font-mono"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={isPending}>
                <Save className="mr-2 h-4 w-4" />
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/intelligence/models">Back to Models</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Delete model</CardTitle>
          <CardDescription>
            This removes the registry entry. Existing access records keep their copied model snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteIntelligenceModelAction} className="flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="model_id" value={String(modelId)} />
            <Button type="submit" variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Model
            </Button>
            <Button variant="outline" asChild>
              <Link href="/intelligence/models">Cancel</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
