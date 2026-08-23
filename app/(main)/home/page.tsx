'use client';

/*
::neup.documentation::home-page
::title Home Page

::public

Renders the plain `/home` server overview. Server cards load first and link
to the selected server workspace without adding selected-server state to the
home URL.

::public end

::end
*/

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getServers } from '@/services/server/server-service';
import { getServerExpiration, isServerDisabled } from '@/services/server/server-metadata';
import { selectServer } from '@/inapp/helpers/selection';

function isExpired(value?: string | null) {
  if (!value) return false;

  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

export default function Home() {
  const router = useRouter();
  const [serversLoading, setServersLoading] = useState(true);
  const [allServers, setAllServers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [firstName, setFirstName] = useState('there');

  useEffect(() => {
    document.title = 'Homepage, Neup.Cloud';

    const profileCookie = document.cookie
      .split('; ')
      .find((part) => part.startsWith('neup_profile_display_name='));
    const displayName = profileCookie
      ? decodeURIComponent(profileCookie.slice('neup_profile_display_name='.length)).trim()
      : '';
    const firstWord = displayName.split(/\s+/).filter(Boolean)[0];
    if (firstWord) setFirstName(firstWord);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadServers() {
      setServersLoading(true);
      try {
        const servers = await getServers();
        if (!cancelled) setAllServers(servers);
      } catch (error) {
        if (!cancelled) console.error('Failed to load servers', error);
      } finally {
        if (!cancelled) setServersLoading(false);
      }
    }

    loadServers();

    return () => {
      cancelled = true;
    };
  }, []);

  const availableServers = allServers.filter(
    (server) =>
      !isServerDisabled(server.moreDetails) &&
      !isExpired(getServerExpiration(server.moreDetails))
  );
  const filteredServers = availableServers.filter((server) => {
    const query = searchQuery.trim().toLowerCase();
    return !query || server.name.toLowerCase().includes(query) || server.publicIp.includes(query);
  });

  const openServer = (id: string) => {
    router.push(selectServer('/server/home', id));
  };

  if (serversLoading && allServers.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
        <p className="text-muted-foreground">Select a server to manage your infrastructure.</p>
      </div>

      {availableServers.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search servers..."
            className="pl-8"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
        {filteredServers.map((server) => (
          <div key={server.id} onClick={() => openServer(server.id)}>
            <Card className="cursor-pointer transition-all hover:border-primary">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="truncate text-sm font-medium">{server.name}</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="truncate text-lg font-semibold">{server.publicIp}</div>
                <p className="truncate text-xs text-muted-foreground">{server.provider}</p>
              </CardContent>
            </Card>
          </div>
        ))}
        <Card
          onClick={() => router.push('/servers/add')}
          className="flex cursor-pointer flex-col items-center justify-center border-dashed p-4 transition-all hover:border-primary"
        >
          <Plus className="mb-1 h-6 w-6 text-muted-foreground" />
          <span className="text-xs font-bold text-muted-foreground">Add New</span>
        </Card>
      </div>

      {!serversLoading && availableServers.length > 0 && filteredServers.length === 0 && (
        <p className="text-sm text-muted-foreground">No servers match your search.</p>
      )}

      {!serversLoading && availableServers.length === 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">No servers found.</p>
          <Button onClick={() => router.push('/servers/add')}>Add a server</Button>
        </div>
      )}
    </div>
  );
}
