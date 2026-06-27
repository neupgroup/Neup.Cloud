import { cookies } from "next/headers";

export type DatabaseEngine = "mariadb" | "postgres";

export async function resolveSelectedServerId(
  searchParams?: Promise<{ selectedServer?: string }>
) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedServerFromQuery = resolvedSearchParams?.selectedServer?.trim();
  if (selectedServerFromQuery) {
    return selectedServerFromQuery;
  }

  const cookieStore = await cookies();
  return cookieStore.get("selected_server")?.value?.trim() || null;
}

export function parseDatabaseRouteId(id: string): { engine: DatabaseEngine; dbName: string } | null {
  const splitIndex = id.indexOf("-");
  if (splitIndex <= 0 || splitIndex === id.length - 1) {
    return null;
  }

  const engine = id.slice(0, splitIndex);
  if (engine !== "mariadb" && engine !== "postgres") {
    return null;
  }

  return {
    engine,
    dbName: id.slice(splitIndex + 1),
  };
}
