'use client';

import { useTransition } from 'react';
import { CheckCircle2, Server, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/core/hooks/use-toast';
import { choosePrimaryApplicationServer } from '@/services/server/applications/service';
import type { ApplicationRunningSection, ApplicationServerMapRow } from '@/services/server/applications/server-map';

function getStatusBadgeClass(status: ApplicationServerMapRow['status']) {
  if (status === 'started') return 'border-green-500/20 bg-green-500/10 text-green-700';
  if (status === 'stopped') return 'border-red-500/20 bg-red-500/10 text-red-700';
  return 'border-slate-500/20 bg-slate-500/10 text-slate-700';
}

type RunningInSectionProps = {
  applicationId: string;
  maps: ApplicationServerMapRow[];
  runningSection: ApplicationRunningSection | null;
};

export function RunningInSection({ applicationId, maps, runningSection }: RunningInSectionProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  if (!runningSection) return null;

  const handleSetPrimary = (serverId: string) => {
    startTransition(async () => {
      try {
        await choosePrimaryApplicationServer(applicationId, serverId);
        toast({ title: 'Primary server updated' });
      } catch (error) {
        console.error(error);
        toast({
          title: 'Could not update primary server',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Card>
      {runningSection ? (
        <>
          <CardHeader>
            <CardTitle>{runningSection.title}</CardTitle>
            <CardDescription>
              {runningSection.title === 'Running in'
                ? 'This application is running on these servers.'
                : 'This application is running on additional servers as well.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {runningSection.servers.map((server) => (
              <div key={server.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium truncate">{server.serverName}</span>
                  {server.isPrimary ? (
                    <Badge variant="outline" className="text-xs">Primary</Badge>
                  ) : null}
                </div>
                <Badge variant="outline" className={getStatusBadgeClass(server.status)}>
                  {server.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </>
      ) : null}

      {maps.length > 1 ? (
        <CardContent className={runningSection ? 'pt-0' : ''}>
          <div className="mb-2 text-sm font-medium">Primary server</div>
          <div className="space-y-2">
            {maps.map((server) => (
              <div key={server.id} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{server.serverName}</span>
                  {server.isSelected ? (
                    <Badge variant="secondary" className="text-xs">Selected</Badge>
                  ) : null}
                  <Badge variant="outline" className={getStatusBadgeClass(server.status)}>
                    {server.status}
                  </Badge>
                </div>
                {server.isPrimary ? (
                  <Badge variant="outline" className="text-xs gap-1 border-primary/20 bg-primary/10 text-primary">
                    <CheckCircle2 className="h-3 w-3" /> Primary
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetPrimary(server.serverId)}
                    disabled={isPending}
                    className="min-w-[96px]"
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set Primary'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
