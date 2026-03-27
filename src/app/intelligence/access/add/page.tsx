import type { Metadata } from 'next';
import { PlusCircle, WandSparkles } from 'lucide-react';

import { PageTitleBack } from '@/components/page-header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getCurrentIntelligenceAccountId } from '@/lib/intelligence/account';
import { getAccessTokens, getIntelligenceModels } from '@/lib/intelligence/store';
import AccessCreateForm from '@/app/intelligence/access/add/access-create-form';

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
        description="A placeholder route for creating a new intelligence access record."
        backHref="/intelligence/access"
      />

      <AccessCreateForm tokens={tokens} models={models} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <WandSparkles className="h-5 w-5 text-primary" />
            Placeholder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The software now generates the access token for you, shows it once for copying, and stores only its hash in the database.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
