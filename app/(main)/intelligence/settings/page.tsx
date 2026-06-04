import type { Metadata } from 'next';
import { ShieldAlert } from 'lucide-react';

import { PageTitle } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getIntelligenceSettingsForAccount,
  updateIntelligenceSettingsAction,
} from '@/services/intelligence/intelligence-service';

export const metadata: Metadata = {
  title: 'Intelligence Settings, Neup.Cloud',
};

export default async function IntelligenceSettingsPage() {
  const settings = await getIntelligenceSettingsForAccount();

  return (
    <div className="grid gap-8">
      <PageTitle
        title={
          <span className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-primary" />
            Intelligence Settings
          </span>
        }
        description="Control debugging and audit behavior for intelligence requests."
      />

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader>
          <CardTitle className="font-headline">Developer mode</CardTitle>
          <CardDescription>
            When enabled, every intelligence request is written to `intelligence_devlog`, including valid responses,
            failed requests, and invalid requests that reach this account context.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateIntelligenceSettingsAction} className="flex flex-col gap-6">
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Enable dev mode</p>
                <p className="text-sm text-muted-foreground">
                  Stores request payloads, headers, responses, errors, and invalid request details for debugging.
                </p>
              </div>
              <input
                type="checkbox"
                name="dev_mode"
                value="on"
                defaultChecked={settings.dev_mode}
                className="h-5 w-5 rounded border-border"
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit">Save settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
