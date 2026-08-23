import { redirect } from 'next/navigation';

export default async function StatusNetworkPage({
  searchParams,
}: {
  searchParams?: Promise<{ selectedServer?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const serverId = resolvedSearchParams.selectedServer?.trim();
  redirect(serverId ? `/server/processes?selectedServer=${encodeURIComponent(serverId)}` : '/server/processes');
}
