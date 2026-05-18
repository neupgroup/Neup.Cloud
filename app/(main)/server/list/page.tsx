"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "universal-cookie";
import { ArrowRight, BadgeInfo, ChevronRight, CirclePlus, ServerIcon, ShieldCheck, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/core/hooks/use-toast";
import { cn } from "@/core/utils";
import { getServers, selectServer } from "@/services/server/server-service";
import type { Server } from "@/services/server/types";
import { getServerExpiration, parseServerMetadata } from "@/services/server/server-metadata";

function formatExpiration(value?: string | null) {
  if (!value) {
    return "No expiration set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid expiration";
  }

  return date.toLocaleString();
}

function isExpired(value?: string | null) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

function ServerCardSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-44" />
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

function ServerCard({
  server,
  isSelected,
  onSelected,
}: {
  server: Server;
  isSelected: boolean;
  onSelected: (id: string) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSwitching, setIsSwitching] = useState(false);

  const expirationAt = getServerExpiration(server.moreDetails);
  const expired = isExpired(expirationAt);
  const serverMetadata = parseServerMetadata(server.moreDetails);

  const handleSwitch = async () => {
    if (isSelected || isSwitching) {
      return;
    }

    setIsSwitching(true);
    try {
      await selectServer(server.id, server.name);
      onSelected(server.id);
      toast({
        title: "Server switched",
        description: `You are now managing ${server.name}.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Switch failed",
        description: "We could not switch the active server.",
      });
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <Card className={cn("transition-colors", isSelected && "border-primary bg-primary/5")}>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-xl">
              <span className="truncate">{server.name}</span>
              {isSelected ? (
                <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Current</span>
              ) : null}
              {expired ? (
                <span className="inline-flex items-center rounded-md bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-700">Expired</span>
              ) : null}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {server.username}@{server.publicIp} · {server.provider} · {server.type}
            </p>
          </div>
          <ServerIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>

        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
            <User className="h-4 w-4" />
            <span className="truncate">{server.username}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
            <BadgeInfo className="h-4 w-4" />
            <span className="truncate">{server.privateIp || "No private IP"}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
            <ShieldCheck className="h-4 w-4" />
            <span className="truncate">{formatExpiration(expirationAt)}</span>
          </div>
        </div>

        {serverMetadata.expiresAt ? (
          <p className="text-xs text-muted-foreground">
            This server is configured to expire on {formatExpiration(serverMetadata.expiresAt)}.
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-wrap gap-2 pt-0">
        <Button variant={isSelected ? "secondary" : "default"} onClick={handleSwitch} disabled={isSelected || isSwitching}>
          {isSwitching ? "Switching..." : isSelected ? "Current server" : "Switch server"}
        </Button>
        <Button variant="outline" onClick={() => router.push(`/server/list/${server.id}`)}>
          Edit server
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>

      <CardFooter className="justify-between border-t bg-muted/20 px-6 py-4 text-sm text-muted-foreground">
        <span className="truncate">ID: {server.id}</span>
        <span className="truncate">{expired ? "Expired" : "Active"}</span>
      </CardFooter>
    </Card>
  );
}

export default function Page() {
  const router = useRouter();
  const { toast } = useToast();
  const [servers, setServers] = useState<Server[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  useEffect(() => {
    const cookieStore = new Cookies(null, { path: "/" });
    setSelectedServerId(cookieStore.get("selected_server") ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadServers = async () => {
      setIsLoading(true);
      try {
        const data = await getServers();
        if (!cancelled) {
          setServers(data);
        }
      } catch (error) {
        console.error(error);
        toast({
          variant: "destructive",
          title: "Could not load servers",
          description: "Please try again.",
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadServers();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  const orderedServers = useMemo(() => {
    return [...servers].sort((left, right) => {
      if (left.id === selectedServerId) return -1;
      if (right.id === selectedServerId) return 1;
      return left.name.localeCompare(right.name);
    });
  }, [servers, selectedServerId]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Server management</p>
          <h1 className="text-4xl font-bold tracking-tight">Servers</h1>
          <p className="max-w-2xl text-muted-foreground">
            Switch the active server, add a new one, or open a server to edit its connection details and expiration.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push("/server/list/add")}>
            <CirclePlus className="mr-2 h-4 w-4" />
            Add server
          </Button>
          <Button variant="secondary" onClick={() => router.push("/server/list/purchase")}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Purchase server
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          <ServerCardSkeleton />
          <ServerCardSkeleton />
          <ServerCardSkeleton />
        </div>
      ) : orderedServers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <ServerIcon className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">No servers yet</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Add your first server to start managing SSH access, web services, databases, and system tasks.
              </p>
            </div>
            <Button onClick={() => router.push("/server/list/add")}>Add your first server</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orderedServers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              isSelected={server.id === selectedServerId}
              onSelected={setSelectedServerId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
