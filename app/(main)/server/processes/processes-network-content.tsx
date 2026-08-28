'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeftRight, Cpu, Globe, Hash, Network, Search, ServerCog, User, XCircle } from 'lucide-react';
import { Card } from '#/components/ui/card';
import { Input } from '#/components/ui/input';
import { Skeleton } from '#/components/ui/skeleton';
import { Badge } from '#/components/ui/badge';
import { cn } from '#/core/utils';
import { useToast } from '#/core/hooks/useToast';
import { getProcesses, killProcess } from '@/services/processes/processes-service';
import type { Process } from '@/services/processes/types';
import { findNetworkConnectionPid, getNetworkConnections, type NetworkConnection } from '@/services/server/network';

function getNetworkStateClass(state: string) {
  const normalized = state.toUpperCase();
  if (normalized === 'LISTEN') return 'text-blue-500';
  if (normalized === 'ESTAB') return 'text-green-500';
  if (normalized === 'CLOSE_WAIT' || normalized === 'TIME_WAIT') return 'text-orange-500';
  return 'text-muted-foreground';
}

export default function ProcessesNetworkContent({ serverId }: { serverId: string }) {
  const { toast } = useToast();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [connections, setConnections] = useState<NetworkConnection[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [killingPid, setKillingPid] = useState<string | null>(null);
  const [findingPid, setFindingPid] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      try {
        const [processResult, networkResult] = await Promise.all([
          getProcesses(serverId),
          getNetworkConnections(serverId),
        ]);

        if (cancelled) return;
        if (processResult.error) {
          toast({ variant: 'destructive', title: 'Error', description: processResult.error });
        } else {
          setProcesses(Array.isArray(processResult.processes) ? processResult.processes : []);
        }
        if (networkResult.error) {
          toast({ variant: 'destructive', title: 'Error', description: networkResult.error });
        } else {
          setConnections(Array.isArray(networkResult.connections) ? networkResult.connections : []);
        }
      } catch {
        if (!cancelled) toast({ variant: 'destructive', title: 'Error', description: 'Failed to load processes and network connections' });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [serverId, toast]);

  const query = search.trim().toLowerCase();
  const filteredConnections = useMemo(() => connections.filter((connection) =>
    !query || [connection.process, connection.pid, connection.port, connection.protocol, connection.state, connection.localAddress, connection.peerAddress]
      .some((value) => value.toLowerCase().includes(query))
  ), [connections, query]);
  const filteredProcesses = useMemo(() => processes.filter((process) =>
    !query || process.name.toLowerCase().includes(query) || process.user.toLowerCase().includes(query) || process.pid.toString().includes(query)
  ), [processes, query]);
  const listeningCount = connections.filter((connection) => connection.state.toUpperCase() === 'LISTEN').length;
  const activeConnectionCount = connections.filter((connection) => connection.state.toUpperCase() === 'ESTAB').length;
  const uniquePortCount = new Set(connections.map((connection) => `${connection.protocol}:${connection.port}`)).size;

  const handleKillProcess = async (pid: string) => {
    setKillingPid(pid);
    try {
      await killProcess(serverId, pid);
      setProcesses((current) => current.filter((process) => process.pid !== pid));
      toast({ title: 'Process terminated' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to kill process' });
    } finally {
      setKillingPid(null);
    }
  };

  const connectionKey = (connection: NetworkConnection) =>
    `${connection.protocol}-${connection.localAddress}-${connection.port}-${connection.peerAddress}-${connection.state}`;

  const handleFindPid = async (connection: NetworkConnection) => {
    const key = connectionKey(connection);
    setFindingPid(key);
    try {
      const result = await findNetworkConnectionPid(serverId, connection);
      if (!result.pid) {
        toast({ variant: 'destructive', title: 'PID not found', description: result.error || 'No process PID was found.' });
        return;
      }

      setConnections((current) => current.map((item) => (
        connectionKey(item) === key
          ? { ...item, pid: result.pid!, process: result.process || item.process }
          : item
      )));
      toast({ title: 'PID found', description: `Process PID ${result.pid} is now available.` });
    } catch {
      toast({ variant: 'destructive', title: 'PID lookup failed', description: 'Could not find the process PID.' });
    } finally {
      setFindingPid(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-xl p-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex min-w-0 items-center gap-4 border border-border p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted"><Cpu className="h-6 w-6 text-foreground" /></div>
            <div><p className="text-xs text-muted-foreground">Processes</p><p className="text-2xl font-semibold">{processes.length}</p></div>
          </div>
          <div className="flex min-w-0 items-center gap-4 border border-border p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted"><Network className="h-6 w-6 text-foreground" /></div>
            <div><p className="text-xs text-muted-foreground">Network Connections</p><p className="text-2xl font-semibold">{connections.length}</p></div>
          </div>
          <div className="flex min-w-0 items-center gap-4 border border-border p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted"><Network className="h-6 w-6 text-foreground" /></div>
            <div><p className="text-xs text-muted-foreground">Listening Ports</p><p className="text-2xl font-semibold">{listeningCount}</p></div>
          </div>
          <div className="flex min-w-0 items-center gap-4 border border-border p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted"><Activity className="h-6 w-6 text-foreground" /></div>
            <div><p className="text-xs text-muted-foreground">Active Connections</p><p className="text-2xl font-semibold">{activeConnectionCount}</p></div>
          </div>
          <div className="flex min-w-0 items-center gap-4 border border-border p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted"><Hash className="h-6 w-6 text-foreground" /></div>
            <div><p className="text-xs text-muted-foreground">Port Bindings</p><p className="text-2xl font-semibold">{uniquePortCount}</p></div>
          </div>
        </div>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search processes and network connections..." className="pl-10" />
      </div>

      {isLoading ? (
        <Card className="p-4"><div className="space-y-5">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div></Card>
      ) : (
        <Card className="overflow-hidden">
          {filteredConnections.map((connection, index) => {
            const processName = connection.process !== '-' ? connection.process : 'System / Unknown';
            const pidUnavailable = connection.pid === '-';
            const pid = pidUnavailable ? 'Unavailable' : connection.pid;
            const key = connectionKey(connection);
            return (
              <div key={`network-${connection.protocol}-${connection.localAddress}-${connection.port}-${index}`} className={cn('p-4 hover:bg-muted/50', index < filteredConnections.length - 1 && 'border-b')}>
                <div className="mb-3 flex flex-wrap items-center gap-2"><Network className="h-4 w-4 text-primary" /><p className="break-all font-mono text-sm font-medium">{processName}</p>{!pidUnavailable && <Badge variant="outline" className="font-mono">PID {pid}</Badge>}</div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" />{connection.port}</span>
                  <span className="flex items-center gap-1.5"><ArrowLeftRight className="h-3.5 w-3.5" />{connection.protocol}</span>
                  <span className={cn('flex items-center gap-1.5', getNetworkStateClass(connection.state))}><Activity className="h-3.5 w-3.5" />{connection.state}</span>
                  <span className="flex items-center gap-1.5 font-mono"><ServerCog className="h-3.5 w-3.5" />{connection.localAddress}:{connection.port}</span>
                  {connection.peerAddress && connection.peerAddress !== '*:*' && <span className="flex items-center gap-1.5 font-mono"><Globe className="h-3.5 w-3.5" />{connection.peerAddress}</span>}
                  {pidUnavailable && <button type="button" onClick={() => handleFindPid(connection)} disabled={findingPid === key} className="flex items-center gap-1.5 text-blue-500 hover:text-blue-600 disabled:opacity-50"><Cpu className="h-3.5 w-3.5" />{findingPid === key ? 'Finding PID...' : 'Find PID'}</button>}
                </div>
              </div>
            );
          })}
          {filteredProcesses.map((process, index) => (
            <div key={`process-${process.pid}`} className={cn('p-4 hover:bg-muted/50', index === 0 && filteredConnections.length > 0 && 'border-t', index < filteredProcesses.length - 1 && 'border-b')}>
              <div className="mb-3 flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" /><p className="break-all font-mono text-sm font-medium">{process.name}</p></div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" />{process.pid}</span>
                <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{process.user}</span>
                <span className="flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5" />{process.cpu} CPU</span>
                <span>{process.memory}% RAM</span>
                <button onClick={() => handleKillProcess(process.pid)} disabled={killingPid === process.pid} className="flex items-center gap-1.5 text-red-500 disabled:opacity-50"><XCircle className="h-3.5 w-3.5" />Kill</button>
              </div>
            </div>
          ))}
          {filteredConnections.length === 0 && filteredProcesses.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No matching processes or network connections.</div>}
        </Card>
      )}
    </div>
  );
}
