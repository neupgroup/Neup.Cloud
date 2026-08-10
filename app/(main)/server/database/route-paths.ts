export type DatabaseEngine = "mariadb" | "postgres";

export function buildDatabaseRouteId(engine: DatabaseEngine, dbName: string) {
  return `${engine}-${dbName}`;
}

export function buildDatabaseUserRouteSlug(username: string, host: string = "%") {
  return `${encodeURIComponent(username)}--${encodeURIComponent(host)}`;
}
