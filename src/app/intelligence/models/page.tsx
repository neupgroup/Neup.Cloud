import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Bot, CircleDollarSign, Plus } from 'lucide-react';

import { PageTitle } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getIntelligenceModels } from '@/lib/intelligence/store';

export const metadata: Metadata = {
  title: 'Intelligence Models, Neup.Cloud',
};

export default async function IntelligenceModelsPage() {
  const models = await getIntelligenceModels();

  return (
    <div className="grid gap-8">
      <PageTitle
        title={
          <span className="flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            Intelligence Models
          </span>
        }
        description="Manage the saved provider models that intelligence access records can use."
      />

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-headline">
            Central model registry
          </CardTitle>
          <CardDescription className="max-w-2xl text-base">
            Add valid OpenAI, Anthropic, or Google model entries here first. Access records copy the model snapshot at creation time, so they do not depend on a live foreign key.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/intelligence/models/add">Add Model</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/intelligence/access/add">Create Access</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <CircleDollarSign className="h-5 w-5 text-primary" />
            Saved Models
          </CardTitle>
        </CardHeader>
        <CardContent>
          {models.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No models saved yet. Add one first so access records can use known-good provider and model values.
            </p>
          ) : (
            <div className="grid gap-4">
              {models.map((model) => (
                <Card key={model.id} className="border-border/70">
                  <CardHeader className="gap-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <CardTitle className="font-headline">{model.title}</CardTitle>
                        <CardDescription>
                          {model.provider}:{model.model}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">ID {model.id}</Badge>
                        <Badge variant="outline">{model.provider}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm text-muted-foreground">
                    <p>{model.description || 'No description provided.'}</p>
                    <div>
                      <p className="font-medium text-foreground">Price JSON</p>
                      <pre className="mt-2 overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                        {JSON.stringify(model.price, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <Button variant="outline" asChild>
                        <Link href={`/intelligence/models/${model.id}`}>
                          View And Edit
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="ghost" asChild className="w-fit">
        <Link href="/intelligence/models/add">
          Add another model
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
