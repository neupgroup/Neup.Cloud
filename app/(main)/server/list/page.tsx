"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, ChevronRight, CirclePlus, Loader2, ServerIcon } from "lucide-react";

import { PageTitle } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/core/hooks/use-toast";
import { useSelectedServerId } from "@/core/hooks/use-selected-server";
import { withSelectedServerQuery } from "@/core/server-context";
import { getServersWithRunningApplications, selectServer } from "@/services/server/server-service";
import { getServerExpiration } from "@/services/server/server-metadata";
import type { Server } from "@/services/server/types";
function sanitizeRedirect(value: string | null) {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  return value;
}

function isExpired(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

type ServerApplicationMap = {
  id: string;
  status: "started" | "stopped" | "inactive";
  isPrimary: boolean;
  application: {
    id: string;
    name: string;
    appIcon?: string | null;
  };
};

type ServerListItem = Server & {
  applicationServerMaps?: ServerApplicationMap[];
};

function getAppInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function getAppStatusClasses(status: ServerApplicationMap["status"]) {
  if (status === "started") {
    return "border-green-500/60";
  }

  if (status === "stopped") {
    return "border-red-500/60";
  }

  return "border-slate-400/60";
}

export default function Page() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const selectedServerId = useSelectedServerId();
  const [servers, setServers] = useState<ServerListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    const candidate = sanitizeRedirect(searchParams.get("redirects"));
    if (!candidate) return null;

    // In case something passed a pathname that already includes Next.js `basePath`,
    // strip it so `router.push` doesn't duplicate it (e.g. /cloud/cloud/server/home).
    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      if (currentPath !== "/" && pathname !== "/" && currentPath.endsWith(pathname)) {
        const basePath = currentPath.slice(0, Math.max(0, currentPath.length - pathname.length));
        if (basePath && candidate.startsWith(basePath)) {
          return candidate.slice(basePath.length) || "/";
        }
      }
    }

    return candidate;
  }, [pathname, searchParams]);

  useEffect(() => {
    let cancelled = false;

    const loadServers = async () => {
      setIsLoading(true);
      try {
        const data = await getServersWithRunningApplications();
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
      const leftExpired = isExpired(getServerExpiration(left.moreDetails));
      const rightExpired = isExpired(getServerExpiration(right.moreDetails));

      if (leftExpired !== rightExpired) {
        return leftExpired ? 1 : -1;
      }

      if (!leftExpired) {
        if (left.id === selectedServerId && right.id !== selectedServerId) return -1;
        if (right.id === selectedServerId && left.id !== selectedServerId) return 1;
      }

      return left.name.localeCompare(right.name);
    });
  }, [servers, selectedServerId]);

  const handleSwitch = async (server: Server) => {
    if (switchingId || server.id === selectedServerId) {
      return;
    }

    setSwitchingId(server.id);
    try {
      await selectServer(server.id, server.name);
      toast({
        title: "Server switched",
        description: `You are now managing ${server.name}.`,
      });
      router.push(withSelectedServerQuery(redirectTo ?? "/server/home", server.id), { scroll: false });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Switch failed",
        description: error instanceof Error ? error.message : "We could not switch the active server.",
      });
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="Servers"
        description="Select a server to manage, or add a new one."
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="w-full justify-between" onClick={() => router.push("/server/list/add")}>
              <span className="flex items-center gap-2">
                <CirclePlus className="h-4 w-4" />
                Add server
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-between"
              onClick={() => router.push("/server/list/purchase")}
            >
              <span className="flex items-center gap-2">
                <ServerIcon className="h-4 w-4" />
                Purchase server
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading servers...</span>
            </div>
          </CardContent>
        </Card>
      ) : orderedServers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <ServerIcon className="h-8 w-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">No servers found</p>
              <p className="text-sm text-muted-foreground">Add your first server to start managing it.</p>
            </div>
            <Button onClick={() => router.push("/server/list/add")}>Add server</Button>
          </CardContent>
        </Card>
      ) : (
        orderedServers.map((server) => {
          const isSelected = server.id === selectedServerId;
          const isSwitching = switchingId === server.id;
          const isServerExpired = isExpired(getServerExpiration(server.moreDetails));
          const appMaps = server.applicationServerMaps ?? [];

          return (
            <Card key={server.id} className={isSelected ? "border-primary" : undefined}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ServerIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="truncate text-sm font-medium">{server.name}</p>
                      {isSelected ? (
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Current
                        </span>
                      ) : null}
                      {isServerExpired ? (
                        <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                          Expired
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {server.username}@{server.publicIp}
                    </p>
                    {appMaps.length > 0 ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="Server applications">
                        {appMaps.slice(0, 6).map((map) => (
                          <div
                            key={map.id}
                            className={`h-8 w-8 overflow-hidden rounded-md border bg-background shadow-sm ${getAppStatusClasses(map.status)}`}
                            title={`${map.application.name} (${map.status})`}
                            aria-label={`${map.application.name} ${map.status}`}
                          >
                            {map.application.appIcon ? (
                              <img
                                src={map.application.appIcon}
                                alt={map.application.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center bg-muted text-[10px] font-semibold text-muted-foreground">
                                {getAppInitial(map.application.name)}
                              </span>
                            )}
                          </div>
                        ))}
                        {appMaps.length > 6 ? (
                          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-dashed border-border px-1 text-[10px] font-medium text-muted-foreground">
                            +{appMaps.length - 6}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {!isServerExpired ? (
                      <Button
                        variant={isSelected ? "secondary" : "default"}
                        disabled={!!switchingId || isSelected}
                        onClick={() => handleSwitch(server)}
                      >
                        {isSwitching ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Switching
                          </>
                        ) : isSelected ? (
                          <>
                            <Check className="h-4 w-4" />
                            Current
                          </>
                        ) : (
                          <>
                            <ArrowRight className="h-4 w-4" />
                            Switch
                          </>
                        )}
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => router.push(`/server/list/${server.id}`)}
                      aria-label={`Edit ${server.name}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
