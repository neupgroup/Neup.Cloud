/*
::neup.documentation::server-initialize-page
::title Server Initialize Page

Server initialization landing page for adding a server or continuing setup on
the currently selected server.

::public

Use `/server/initialize` to start or continue server setup workflows.

::public end

::private

The page preserves selected-server query context when linking to setup-related
server routes.

::private end

::end
*/

import type { Metadata } from "next";
import { InitializeClient } from "./initialize-client";
import { getServer } from "@/services/server/server-service";

export const metadata: Metadata = {
  title: "Initialize Server | Neup.Cloud",
};

export default async function InitializeServerPage({
  searchParams,
}: {
  searchParams?: Promise<{ selectedServer?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const serverId = resolvedSearchParams.selectedServer?.trim() || null;
  const serverName = serverId ? (await getServer(serverId))?.name ?? null : null;

  return <InitializeClient serverId={serverId} serverName={serverName} />;
}
