import type { Metadata } from 'next';
import { PlusCircle, WandSparkles } from 'lucide-react';

import { PageTitleBack } from '@/components/page-header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getCurrentIntelligenceAccountId } from '@/core/ai/files/intelligence/account';
import { getAccessTokens, getIntelligenceModels } from '@/core/ai/files/intelligence/store';
import AccessCreateForm from '@/app/(main)/intelligence/access/add/access-create-form';

export const metadata: Metadata = {
  title: 'Add Intelligence Access, Neup.Cloud',
};

export default async function IntelligenceAccessAddPage() {
  const accountId = await getCurrentIntelligenceAccountId();
  const [tokens, models] = await Promise.all([
    getAccessTokens(accountId),
    getIntelligenceModels(),
  ]);

  return (
    <div className="grid gap-8">
      <PageTitleBack
        title={
          <span className="flex items-center gap-3">
            <PlusCircle className="h-8 w-8 text-primary" />
            Add Intelligence Access
          </span>
        }
        description="Create a new access record with a specific type: open, hybrid, or closed."
        backHref="/intelligence/access"
      />

      <AccessCreateForm tokens={tokens} models={models} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <WandSparkles className="h-5 w-5 text-primary" />
            Access Setup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select a type and configure access. The access token is shown once for copying and stored as a hash. Use the details field to store models and encrypted keys based on your access type.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
