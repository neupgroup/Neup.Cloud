import { PageTitleBack } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import NetworkStatusClient from "./network-status-client";
import { Network, Server } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getServer } from "@/services/server/server-service";

export const metadata: Metadata = {
  title: "Network Details | Server Status | Neup.Cloud",
};

export default async function StatusNetworkPage({
  searchParams,
}: {
  searchParams?: Promise<{ selectedServer?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const serverId = resolvedSearchParams.selectedServer?.trim() || null;
  const serverName = serverId ? (await getServer(serverId))?.name ?? null : null;

  return (
    <div className="space-y-6">
      <PageTitleBack
        backHref="/server/status"
        title={
          <span className="flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            Network Status
          </span>
        }
        description="View active ports, listeners, processes, and network connections"
        serverName={serverName}
      />

      {!serverId ? (
        <Card className="text-center p-8">
          <Server className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No Server Selected</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Please go to the status page and try again.
          </p>
          <Button asChild className="mt-4">
            <Link href="/server/status">Go to Status</Link>
          </Button>
        </Card>
      ) : (
        <NetworkStatusClient serverId={serverId ?? undefined} />
      )}
    </div>
  );
}
