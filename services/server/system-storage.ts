'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';

const OVERVIEW_TTL_MS = 15_000;
const BREAKDOWN_TTL_MS = 60_000;

type CacheEntry<T> = { at: number; value: T };

const overviewCache = new Map<string, CacheEntry<{ data?: Pick<StorageInfo, 'disk' | 'swap'>; error?: string }>>();
const breakdownCache = new Map<string, CacheEntry<{ data?: { diskTotalBytes: number; sections: StorageSection[] }; error?: string }>>();

const overviewInFlight = new Map<string, Promise<{ data?: Pick<StorageInfo, 'disk' | 'swap'>; error?: string }>>();
const breakdownInFlight = new Map<string, Promise<{ data?: { diskTotalBytes: number; sections: StorageSection[] }; error?: string }>>();

async function cached<T>(
    key: string,
    ttlMs: number,
    cache: Map<string, CacheEntry<T>>,
    inFlight: Map<string, Promise<T>>,
    fn: () => Promise<T>
): Promise<T> {
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && now - hit.at < ttlMs) return hit.value;

    const inflight = inFlight.get(key);
    if (inflight) return inflight;

    const p = fn()
        .then((value) => {
            cache.set(key, { at: Date.now(), value });
            return value;
        })
        .finally(() => {
            inFlight.delete(key);
        });

    inFlight.set(key, p);
    return p;
}

export type StorageSection = {
    label: string;
    usedBytes: number;
    totalBytes: number;
    /** false means the section is not applicable / not installed / not measurable */
    available: boolean;
};

export type StorageInfo = {
    /** Root filesystem totals */
    disk: {
        totalBytes: number;
        usedBytes: number;
        availableBytes: number;
    };
    swap: {
        totalBytes: number;
        usedBytes: number;
    };
    sections: StorageSection[];
};

export async function getStorageOverview(
    serverId: string
): Promise<{ data?: Pick<StorageInfo, 'disk' | 'swap'>; error?: string }> {
    return cached(
        `overview:${serverId}`,
        OVERVIEW_TTL_MS,
        overviewCache,
        overviewInFlight,
        () => getStorageOverviewUncached(serverId)
    );
}

async function getStorageOverviewUncached(
    serverId: string
): Promise<{ data?: Pick<StorageInfo, 'disk' | 'swap'>; error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        return { error: 'Server not found or missing SSH credentials.' };
    }

    // Fast commands only (no sudo / no directory walks).
    const script = [
        'df_out=$(df -B1 / 2>/dev/null | awk \'NR==2{print $2,$3,$4}\')',
        'DISK_TOTAL=$(echo $df_out | awk \'{print $1}\')',
        'DISK_USED=$(echo $df_out | awk \'{print $2}\')',
        'DISK_AVAIL=$(echo $df_out | awk \'{print $3}\')',
        'echo "DISK=${DISK_TOTAL}:${DISK_USED}:${DISK_AVAIL}"',
        '',
        'swap_out=$(free -b 2>/dev/null | awk \'/^Swap/{print $2,$3}\')',
        'SWAP_TOTAL=$(echo $swap_out | awk \'{print $1}\')',
        'SWAP_USED=$(echo $swap_out | awk \'{print $2}\')',
        'echo "SWAP=${SWAP_TOTAL:-0}:${SWAP_USED:-0}"',
    ].join('\n');

    try {
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            script,
            undefined,
            undefined,
            true // skipSwap
        );

        if (result.code !== 0) {
            return { error: result.stderr || 'Failed to collect storage overview.' };
        }

        const kv: Record<string, string> = {};
        for (const line of result.stdout.trim().split('\n')) {
            const eq = line.indexOf('=');
            if (eq === -1) continue;
            kv[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
        }

        const parseTriple = (v: string) => {
            const [a, b, c] = (v || '0:0:0').split(':').map((x) => parseInt(x, 10) || 0);
            return [a, b, c] as [number, number, number];
        };
        const parsePair = (v: string) => {
            const [a, b] = (v || '0:0').split(':').map((x) => parseInt(x, 10) || 0);
            return [a, b] as [number, number];
        };

        const [diskTotal, diskUsed, diskAvail] = parseTriple(kv['DISK'] ?? '');
        const [swapTotal, swapUsed] = parsePair(kv['SWAP'] ?? '');

        return {
            data: {
                disk: {
                    totalBytes: diskTotal,
                    usedBytes: diskUsed,
                    availableBytes: diskAvail,
                },
                swap: {
                    totalBytes: swapTotal,
                    usedBytes: swapUsed,
                },
            },
        };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function getStorageBreakdown(
    serverId: string
): Promise<{ data?: { diskTotalBytes: number; sections: StorageSection[] }; error?: string }> {
    return cached(
        `breakdown:${serverId}`,
        BREAKDOWN_TTL_MS,
        breakdownCache,
        breakdownInFlight,
        () => getStorageBreakdownUncached(serverId)
    );
}

async function getStorageBreakdownUncached(
    serverId: string
): Promise<{ data?: { diskTotalBytes: number; sections: StorageSection[] }; error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        return { error: 'Server not found or missing SSH credentials.' };
    }

    // Directory walks can be extremely slow. Guard with:
    // - non-interactive sudo (avoid hanging on password prompts)
    // - per-command timeout if available
    const script = [
        'SUDO=""',
        'if command -v sudo >/dev/null 2>&1; then',
        '  if sudo -n true >/dev/null 2>&1; then',
        '    SUDO="sudo -n"',
        '  fi',
        'fi',
        '',
        'TIMEOUT=""',
        'if command -v timeout >/dev/null 2>&1; then',
        '  TIMEOUT="timeout 8"',
        'fi',
        '',
        // Disk total for % calculations client-side
        'df_out=$(df -B1 / 2>/dev/null | awk \'NR==2{print $2}\')',
        'DISK_TOTAL=${df_out:-0}',
        'echo "DISK_TOTAL=${DISK_TOTAL}"',
        '',
        // If sudo isn't available, do not attempt deep scans.
        'if [ -z "$SUDO" ]; then',
        '  echo "NO_SUDO=1"',
        '  exit 0',
        'fi',
        '',
        // Smaller + high-signal directories first.
        'USER_USED=$($TIMEOUT $SUDO du -sb /home 2>/dev/null | awk \'{print $1}\' || echo 0)',
        'echo "USER_HOME=${USER_USED:-0}"',
        '',
        'SYS_USED=$($TIMEOUT $SUDO du -sbc /usr /lib /lib64 /bin /sbin /etc 2>/dev/null | tail -1 | awk \'{print $1}\' || echo 0)',
        'echo "SYSTEM=${SYS_USED:-0}"',
        '',
        'TMP_USED=$($TIMEOUT $SUDO du -sbc /tmp /var/tmp 2>/dev/null | tail -1 | awk \'{print $1}\' || echo 0)',
        'echo "TMP=${TMP_USED:-0}"',
        '',
        'LOG_USED=$($TIMEOUT $SUDO du -sb /var/log 2>/dev/null | awk \'{print $1}\' || echo 0)',
        'echo "LOGS=${LOG_USED:-0}"',
        '',
        'PG_INSTALLED=0',
        'PG_USED=0',
        'if command -v psql >/dev/null 2>&1 || [ -d /var/lib/postgresql ]; then',
        '  PG_INSTALLED=1',
        '  PG_USED=$($TIMEOUT $SUDO du -sb /var/lib/postgresql 2>/dev/null | awk \'{print $1}\' || echo 0)',
        '  if [ -z "$PG_USED" ] || [ "$PG_USED" = "0" ]; then',
        '    PG_USED=$($TIMEOUT $SUDO du -sb /var/lib/pgsql 2>/dev/null | awk \'{print $1}\' || echo 0)',
        '  fi',
        'fi',
        'echo "POSTGRES=${PG_INSTALLED}:${PG_USED:-0}"',
        '',
        'MYSQL_INSTALLED=0',
        'MYSQL_USED=0',
        'if command -v mysql >/dev/null 2>&1 || [ -d /var/lib/mysql ]; then',
        '  MYSQL_INSTALLED=1',
        '  MYSQL_USED=$($TIMEOUT $SUDO du -sb /var/lib/mysql 2>/dev/null | awk \'{print $1}\' || echo 0)',
        'fi',
        'echo "MYSQL=${MYSQL_INSTALLED}:${MYSQL_USED:-0}"',
    ].join('\n');

    try {
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            script,
            undefined,
            undefined,
            true // skipSwap
        );

        if (result.code !== 0) {
            return { error: result.stderr || 'Failed to collect storage breakdown.' };
        }

        const kv: Record<string, string> = {};
        for (const line of result.stdout.trim().split('\n')) {
            const eq = line.indexOf('=');
            if (eq === -1) continue;
            kv[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
        }

        const diskTotal = parseInt(kv['DISK_TOTAL'] ?? '0', 10) || 0;
        const noSudo = (kv['NO_SUDO'] ?? '') === '1';

        const parsePair = (v: string) => {
            const [a, b] = (v || '0:0').split(':').map((x) => parseInt(x, 10) || 0);
            return [a, b] as [number, number];
        };

        const userUsed = parseInt(kv['USER_HOME'] ?? '0', 10) || 0;
        const sysUsed = parseInt(kv['SYSTEM'] ?? '0', 10) || 0;
        const tmpUsed = parseInt(kv['TMP'] ?? '0', 10) || 0;
        const logUsed = parseInt(kv['LOGS'] ?? '0', 10) || 0;
        const [pgInstalled, pgUsed] = parsePair(kv['POSTGRES'] ?? '');
        const [mysqlInstalled, mysqlUsed] = parsePair(kv['MYSQL'] ?? '');

        const sections: StorageSection[] = [
            { label: 'System', usedBytes: sysUsed, totalBytes: diskTotal, available: !noSudo },
            { label: 'User Accounts', usedBytes: userUsed, totalBytes: diskTotal, available: !noSudo },
            { label: 'Logs', usedBytes: logUsed, totalBytes: diskTotal, available: !noSudo },
            { label: 'Temporary Files', usedBytes: tmpUsed, totalBytes: diskTotal, available: !noSudo },
            { label: 'PostgreSQL', usedBytes: pgUsed, totalBytes: diskTotal, available: !noSudo && pgInstalled === 1 },
            { label: 'MySQL / MariaDB', usedBytes: mysqlUsed, totalBytes: diskTotal, available: !noSudo && mysqlInstalled === 1 },
        ];

        return { data: { diskTotalBytes: diskTotal, sections } };
    } catch (e: any) {
        return { error: e.message };
    }
}

// Backwards-compatible combined call (not used by the UI after May 2026).
export async function getStorageInfo(serverId: string): Promise<{ data?: StorageInfo; error?: string }> {
    const [overview, breakdown] = await Promise.all([
        getStorageOverview(serverId),
        getStorageBreakdown(serverId),
    ]);

    if (overview.error) return { error: overview.error };
    if (!overview.data) return { error: 'Failed to collect storage overview.' };

    const sections = breakdown.data?.sections ?? [];
    return {
        data: {
            disk: overview.data.disk,
            swap: overview.data.swap,
            sections,
        },
        error: breakdown.error,
    };
}
