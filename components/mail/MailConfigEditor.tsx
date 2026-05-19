'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTitleBack } from '@/components/page-header';
import { getDomains } from '@/services/domains/domains-service';
import type { ManagedDomain } from '@/services/domains/types';
import { getServers } from '@/services/server/server-service';
import type { Server } from '@/services/server/types';
import { executeCommand } from '@/services/server/commands/server-command-service';
import { Loader2, Play } from 'lucide-react';

export default function MailConfigEditor() {
  const [domains, setDomains] = useState<ManagedDomain[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [isDomainsLoading, setIsDomainsLoading] = useState(true);
  const [isServersLoading, setIsServersLoading] = useState(true);
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [isRunningPortCheck, setIsRunningPortCheck] = useState(false);
  const [portCheckOutput, setPortCheckOutput] = useState<string>('');
  const [portCheckError, setPortCheckError] = useState<string>('');

  useEffect(() => {
    const loadDomains = async () => {
      setIsDomainsLoading(true);
      try {
        const result = await getDomains();
        setDomains(result);
      } finally {
        setIsDomainsLoading(false);
      }
    };

    const loadServers = async () => {
      setIsServersLoading(true);
      try {
        const result = await getServers();
        setServers(result);
      } finally {
        setIsServersLoading(false);
      }
    };

    loadDomains();
    loadServers();
  }, []);

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.id === selectedDomainId),
    [domains, selectedDomainId]
  );

  const selectedServer = useMemo(
    () => servers.find((server) => server.id === selectedServerId),
    [servers, selectedServerId]
  );

  useEffect(() => {
    setSelectedServerId('');
    setPortCheckOutput('');
    setPortCheckError('');
  }, [selectedDomainId]);

  useEffect(() => {
    setPortCheckOutput('');
    setPortCheckError('');
  }, [selectedServerId]);

  const handleRunPortCheck = async () => {
    if (!selectedServerId || isRunningPortCheck) {
      return;
    }

    setIsRunningPortCheck(true);
    setPortCheckOutput('');
    setPortCheckError('');

    try {
      const command = 'nc -vz gmail-smtp-in.l.google.com 25';
      const result = await executeCommand(
        selectedServerId,
        command,
        'Mail Port 25 Check',
        command,
        'mail:port25-check'
      );

      if (result.error) {
        setPortCheckError(result.error);
      }

      if (result.output) {
        setPortCheckOutput(result.output);
      }
    } finally {
      setIsRunningPortCheck(false);
    }
  };

  return (
    <div className="grid gap-6 pb-10">
      <PageTitleBack
        backHref="/server/webservices/nginx"
        title="Mail"
        description="Configure email for your domain in guided steps."
      />

      <Card className="p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Step 1</h2>
          <p className="text-sm text-muted-foreground">
            Choose the domain you want to configure the email for.
          </p>
        </div>

        {isDomainsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No domains found. Add or connect a domain first to continue.
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="mail-domain">Domain</Label>
            <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
              <SelectTrigger id="mail-domain">
                <SelectValue placeholder="Select a domain" />
              </SelectTrigger>
              <SelectContent>
                {domains.map((domain) => (
                  <SelectItem key={domain.id} value={domain.id}>
                    {domain.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedDomain ? (
          <p className="text-sm text-muted-foreground">
            Selected domain: <span className="font-medium text-foreground">{selectedDomain.name}</span>
          </p>
        ) : null}

        {selectedDomain ? (
          <>
            <div className="space-y-1 pt-2">
              <h2 className="text-lg font-semibold">Step 2</h2>
              <p className="text-sm text-muted-foreground">
                Choose what server is to handle the mail service.
              </p>
            </div>

            {isServersLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : servers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No servers found. Add a server first to continue.
              </p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="mail-server">Server</Label>
                <Select value={selectedServerId} onValueChange={setSelectedServerId}>
                  <SelectTrigger id="mail-server">
                    <SelectValue placeholder="Select a server" />
                  </SelectTrigger>
                  <SelectContent>
                    {servers.map((server) => (
                      <SelectItem key={server.id} value={server.id}>
                        {server.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedServer ? (
              <p className="text-sm text-muted-foreground">
                Selected server: <span className="font-medium text-foreground">{selectedServer.name}</span>
              </p>
            ) : null}

            {selectedServer ? (
              <>
                <div className="space-y-1 pt-2">
                  <h2 className="text-lg font-semibold">Step 3</h2>
                  <p className="text-sm text-muted-foreground">
                    Run this command in the selected server.
                  </p>
                </div>

                <div className="font-mono text-sm p-4 whitespace-pre-wrap overflow-x-auto bg-muted/30 border rounded-md text-foreground">
                  nc -vz gmail-smtp-in.l.google.com 25
                </div>

                <div>
                  <Button
                    type="button"
                    onClick={handleRunPortCheck}
                    disabled={isRunningPortCheck}
                    className="inline-flex items-center gap-2"
                  >
                    {isRunningPortCheck ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {isRunningPortCheck ? 'Running...' : 'Run in Selected Server'}
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                  This will check if port 25 is unblocked or blocked.
                </p>

                {portCheckError ? (
                  <div className="font-mono text-sm p-4 whitespace-pre-wrap overflow-x-auto bg-destructive/10 border border-destructive/30 rounded-md text-destructive">
                    {portCheckError}
                  </div>
                ) : null}

                {portCheckOutput ? (
                  <div className="font-mono text-sm p-4 whitespace-pre-wrap overflow-x-auto bg-zinc-950 text-zinc-50 border border-zinc-800/50 rounded-md">
                    {portCheckOutput}
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </Card>
    </div>
  );
}
