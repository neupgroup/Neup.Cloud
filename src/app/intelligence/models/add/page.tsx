import type { Metadata } from 'next';
import Link from 'next/link';
import { Bot, PlusCircle } from 'lucide-react';

import { createIntelligenceModelAction } from '@/app/intelligence/actions';
import { PageTitleBack } from '@/components/page-header';
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

export const metadata: Metadata = {
  title: 'Add Intelligence Model, Neup.Cloud',
};

export default function IntelligenceModelsAddPage() {
  return (
    <div className="grid gap-8">
      <PageTitleBack
        title={
          <span className="flex items-center gap-3">
            <PlusCircle className="h-8 w-8 text-primary" />
            Add Intelligence Model
          </span>
        }
        description="Save a provider model definition that can be reused by access records."
        backHref="/intelligence/models"
      />

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Bot className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-headline">
            Model registry entry
          </CardTitle>
          <CardDescription className="max-w-2xl text-base">
            Save the exact provider and model values here so access records can copy them without relying on manual typing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createIntelligenceModelAction} className="grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" placeholder="Gemini 2.5 Flash" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="provider">Provider</Label>
                <select
                  id="provider"
                  name="provider"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  defaultValue="openai"
                >
                  <option value="openai">openai</option>
                  <option value="anthropic">anthropic</option>
                  <option value="google">google</option>
                </select>
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="model">Model</Label>
                <Input id="model" name="model" placeholder="gpt-4.1-mini or gemini-2.5-flash" required />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Fast general-purpose model for real-time assistant replies."
                className="min-h-24"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="price">Price JSON</Label>
              <Textarea
                id="price"
                name="price"
                placeholder='{"inputPer1M":0.15,"outputPer1M":0.6}'
                className="min-h-32 font-mono"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit">Save Model</Button>
              <Button variant="outline" asChild>
                <Link href="/intelligence/models">Back to Models</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
