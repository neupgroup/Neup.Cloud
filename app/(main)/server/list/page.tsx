"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Cookies from "universal-cookie";
import { ArrowRight, Check, ChevronRight, CirclePlus, Loader2, ServerIcon } from "lucide-react";

import { PageTitle } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/core/hooks/use-toast";
import { getServers, selectServer } from "@/services/server/server-service";
import type { Server } from "@/services/server/types";
function sanitizeRedirect(value: string | null) {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  return value;
}

export default function Page() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [servers, setServers] = useState<Server[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
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

  const handleSwitch = async (server: Server) => {
    if (switchingId || server.id === selectedServerId) {
      return;
    }

    setSwitchingId(server.id);
    try {
      await selectServer(server.id, server.name);
      setSelectedServerId(server.id);
      toast({
        title: "Server switched",
        description: `You are now managing ${server.name}.`,
      });
      router.push(redirectTo ?? "/server/home");
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Switch failed",
        description: "We could not switch the active server.",
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
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {server.username}@{server.publicIp}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
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
