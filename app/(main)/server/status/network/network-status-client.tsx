'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeftRight, Globe, Hash, Loader2, Network, RefreshCw, Search, ServerCog } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/core/utils';
import { useToast } from '@/core/hooks/use-toast';
import { getNetworkConnections, type NetworkConnection } from '@/services/server/network';

type NetworkStatusClientProps = {
  serverId: string;
};

function getStateClass(state: string) {
  const normalized = state.toUpperCase();

  if (normalized === 'LISTEN') return 'text-blue-500';
  if (normalized === 'ESTAB') return 'text-green-500';
  if (normalized === 'UNCONN') return 'text-purple-500';
  if (normalized === 'CLOSE_WAIT' || normalized === 'TIME_WAIT') return 'text-orange-500';

  return 'text-muted-foreground';
}

function NetworkLoadingSkeleton() {
  return (
    <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'p-4 min-w-0 w-full',
            index !== 7 && 'border-b border-border'
          )}
        >
          <div className="space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <div className="flex flex-wrap gap-6">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
    </Card>
  );
}

function ConnectionList({ connections }: { connections: NetworkConnection[] }) {
  if (connections.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">No matching network connections found.</p>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
      {connections.map((connection, index) => {
        const processName = connection.process !== '-' ? connection.process : 'System / Unknown';
        const pid = connection.pid !== '-' ? connection.pid : 'Unavailable';
        const showPeer = connection.peerAddress && connection.peerAddress !== '*:*';

        return (
          <div
            key={`${connection.protocol}-${connection.localAddress}-${connection.port}-${connection.pid}-${index}`}
            className={cn(
              'p-4 min-w-0 w-full transition-colors hover:bg-muted/50',
              index !== connections.length - 1 && 'border-b border-border'
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="break-all font-mono text-sm font-medium leading-tight text-foreground">
                  {processName}
                </p>
                <Badge variant="outline" className="font-mono">
                  PID {pid}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Hash className="h-3.5 w-3.5" />
                  <span className="font-mono">{connection.port}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  <span>{connection.protocol}</span>
                </div>
                <div className={cn('flex items-center gap-1.5 shrink-0', getStateClass(connection.state))}>
                  <Activity className="h-3.5 w-3.5" />
                  <span className="font-medium">{connection.state}</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <ServerCog className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-mono break-all">
                    {connection.localAddress}:{connection.port}
                  </span>
                </div>
                {showPeer && (
                  <div className="flex items-center gap-1.5 min-w-0" title={`Peer: ${connection.peerAddress}`}>
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-mono break-all">{connection.peerAddress}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

export default function NetworkStatusClient({ serverId }: NetworkStatusClientProps) {
  const { toast } = useToast();
  const [connections, setConnections] = useState<NetworkConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchConnections = async ({ quiet = false } = {}) => {
    if (quiet) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const result = await getNetworkConnections(serverId);
      if (result.error) {
        setConnections([]);
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      } else {
        setConnections(Array.isArray(result.connections) ? result.connections : []);
      }
    } catch {
      setConnections([]);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch network connections' });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [serverId]);

  const filteredConnections = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return connections;

    return connections.filter((connection) =>
      connection.process.toLowerCase().includes(query) ||
      connection.pid.toLowerCase().includes(query) ||
      connection.port.includes(query) ||
      connection.protocol.toLowerCase().includes(query) ||
      connection.state.toLowerCase().includes(query) ||
      connection.localAddress.toLowerCase().includes(query) ||
      connection.peerAddress.toLowerCase().includes(query)
    );
  }, [connections, search]);

  const listeningCount = connections.filter((connection) => connection.state.toUpperCase() === 'LISTEN').length;
  const activeCount = connections.filter((connection) => connection.state.toUpperCase() === 'ESTAB').length;
  const uniquePortsCount = new Set(connections.map((connection) => `${connection.protocol}:${connection.port}`)).size;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Listening Ports" value={listeningCount} icon={Network} />
        <SummaryCard label="Active Connections" value={activeCount} icon={Activity} />
        <SummaryCard label="Unique Port Bindings" value={uniquePortsCount} icon={Hash} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search process, PID, port, protocol, state, or address..."
            className="pl-10"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => fetchConnections({ quiet: true })}
          disabled={isLoading || isRefreshing}
          className="sm:w-auto"
        >
          {isRefreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredConnections.length} of {connections.length} network connection{connections.length === 1 ? '' : 's'}.
      </div>

      {isLoading ? (
        <NetworkLoadingSkeleton />
      ) : (
        <ConnectionList connections={filteredConnections} />
      )}
    </div>
  );
}
