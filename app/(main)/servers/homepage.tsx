"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getServers, selectServer } from "@/services/server/server-service";
import type { Server } from "@/services/server/types";
import { Loader2, ServerIcon, ArrowRight } from "lucide-react";
import { withSelectedServerQuery } from "@/core/server-context";

export default function ServersHomepage() {
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const data = await getServers();
        setServers(data);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSwitch = async (id: string, name: string) => {
    setSwitchingId(id);
    await selectServer(id, name);
    setSwitchingId(null);
    router.push(withSelectedServerQuery("/server/home", id));
  };

  return (
    <div className="max-w-2xl mx-auto py-12 space-y-8">
      <h1 className="text-3xl font-bold mb-4">Server Dashboard</h1>
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-2">Quick Actions</h2>
          <div className="flex flex-col gap-4">
            <Button variant="outline" onClick={() => router.push("/servers/add")}>Add New Server</Button>
            <Button variant="outline" onClick={() => router.push("/servers/purchase")}>Purchase Managed Server</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-2">Switch Server</h2>
          {isLoading ? (
            <Loader2 className="animate-spin" />
          ) : servers.length === 0 ? (
            <div className="text-muted-foreground">No servers found.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {servers.map(server => (
                <Button
                  key={server.id}
                  variant="ghost"
                  className="flex items-center justify-between"
                  disabled={!!switchingId}
                  onClick={() => handleSwitch(server.id, server.name)}
                >
                  <span className="flex items-center gap-2">
                    <ServerIcon className="h-4 w-4" />
                    {server.name}
                  </span>
                  {switchingId === server.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
