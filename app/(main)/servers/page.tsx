'use client';

/*
::neup.documentation::servers-page
::title Servers Page

::public

Renders the `/servers` page with server quick actions and a server switcher.

::public end

::end
*/

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, ServerIcon } from 'lucide-react';
import { Button } from '@/component/ui/button';
import { Card, CardContent } from '@/component/ui/card';
import { getServers } from '@/services/server/server-service';
import type { Server } from '@/services/server/types';
import { selectServer } from '@/inapp/helpers/selection';

export default function ServersPage() {
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadServers() {
      setIsLoading(true);
      try {
        const data = await getServers();
        if (isMounted) {
          setServers(data);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadServers();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSwitch = async (id: string) => {
    setSwitchingId(id);
    try {
      router.push(selectServer('/server/home', id));
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-12">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Server Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Add, purchase, or switch into a server workspace.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-xl font-semibold">Quick Actions</h2>
          <div className="flex flex-col gap-4">
            <Button variant="outline" onClick={() => router.push('/servers/add')}>
              Add New Server
            </Button>
            <Button variant="outline" onClick={() => router.push('/servers/purchase')}>
              Purchase Managed Server
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-xl font-semibold">Switch Server</h2>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : servers.length === 0 ? (
            <div className="text-sm text-muted-foreground">No servers found.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {servers.map((server) => (
                <Button
                  key={server.id}
                  variant="ghost"
                  className="flex items-center justify-between"
                  disabled={Boolean(switchingId)}
                  onClick={() => handleSwitch(server.id)}
                >
                  <span className="flex items-center gap-2">
                    <ServerIcon className="h-4 w-4" />
                    {server.name}
                  </span>
                  {switchingId === server.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
