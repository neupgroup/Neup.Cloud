'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';

export type StorageSection = {
    label: string;
    usedBytes: number;
    totalBytes: number;
    /** null means the section is not applicable / not installed */
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

export async function getStorageInfo(serverId: string): Promise<{ data?: StorageInfo; error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        return { error: 'Server not found or missing SSH credentials.' };
    }

    // Single script — all output is key=value lines for easy parsing.
    // Shell ${VAR:-default} expressions are escaped as \${...} so TS doesn't
    // try to interpolate them as template literal expressions.
    const script = [
        '# Disk (root filesystem)',
        'df_out=$(df -B1 / 2>/dev/null | awk \'NR==2{print $2,$3,$4}\')',
        'DISK_TOTAL=$(echo $df_out | awk \'{print $1}\')',
        'DISK_USED=$(echo $df_out | awk \'{print $2}\')',
        'DISK_AVAIL=$(echo $df_out | awk \'{print $3}\')',
        'echo "DISK=${DISK_TOTAL}:${DISK_USED}:${DISK_AVAIL}"',
        '',
        '# Swap',
        'swap_out=$(free -b 2>/dev/null | awk \'/^Swap/{print $2,$3}\')',
        'SWAP_TOTAL=$(echo $swap_out | awk \'{print $1}\')',
        'SWAP_USED=$(echo $swap_out | awk \'{print $2}\')',
        'echo "SWAP=${SWAP_TOTAL:-0}:${SWAP_USED:-0}"',
        '',
        '# User home dirs',
        'USER_USED=$(sudo du -sb /home 2>/dev/null | awk \'{print $1}\')',
        'echo "USER_HOME=${USER_USED:-0}"',
        '',
        '# System dirs',
        'SYS_USED=$(sudo du -sbc /usr /lib /lib64 /bin /sbin /etc 2>/dev/null | tail -1 | awk \'{print $1}\')',
        'echo "SYSTEM=${SYS_USED:-0}"',
        '',
        '# Temporary files',
        'TMP_USED=$(sudo du -sbc /tmp /var/tmp 2>/dev/null | tail -1 | awk \'{print $1}\')',
        'echo "TMP=${TMP_USED:-0}"',
        '',
        '# Logs',
        'LOG_USED=$(sudo du -sb /var/log 2>/dev/null | awk \'{print $1}\')',
        'echo "LOGS=${LOG_USED:-0}"',
        '',
        '# PostgreSQL',
        'PG_INSTALLED=0',
        'PG_USED=0',
        'if command -v psql >/dev/null 2>&1 || [ -d /var/lib/postgresql ]; then',
        '    PG_INSTALLED=1',
        '    PG_USED=$(sudo du -sb /var/lib/postgresql 2>/dev/null | awk \'{print $1}\')',
        '    if [ -z "$PG_USED" ]; then',
        '        PG_USED=$(sudo du -sb /var/lib/pgsql 2>/dev/null | awk \'{print $1}\')',
        '    fi',
        'fi',
        'echo "POSTGRES=${PG_INSTALLED}:${PG_USED:-0}"',
        '',
        '# MySQL / MariaDB',
        'MYSQL_INSTALLED=0',
        'MYSQL_USED=0',
        'if command -v mysql >/dev/null 2>&1 || [ -d /var/lib/mysql ]; then',
        '    MYSQL_INSTALLED=1',
        '    MYSQL_USED=$(sudo du -sb /var/lib/mysql 2>/dev/null | awk \'{print $1}\')',
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
            return { error: result.stderr || 'Failed to collect storage info.' };
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
        const userUsed = parseInt(kv['USER_HOME'] ?? '0', 10) || 0;
        const sysUsed = parseInt(kv['SYSTEM'] ?? '0', 10) || 0;
        const tmpUsed = parseInt(kv['TMP'] ?? '0', 10) || 0;
        const logUsed = parseInt(kv['LOGS'] ?? '0', 10) || 0;
        const [pgInstalled, pgUsed] = parsePair(kv['POSTGRES'] ?? '');
        const [mysqlInstalled, mysqlUsed] = parsePair(kv['MYSQL'] ?? '');

        const sections: StorageSection[] = [
            {
                label: 'System',
                usedBytes: sysUsed,
                totalBytes: diskTotal,
                available: true,
            },
            {
                label: 'User Accounts',
                usedBytes: userUsed,
                totalBytes: diskTotal,
                available: true,
            },
            {
                label: 'Logs',
                usedBytes: logUsed,
                totalBytes: diskTotal,
                available: true,
            },
            {
                label: 'Temporary Files',
                usedBytes: tmpUsed,
                totalBytes: diskTotal,
                available: true,
            },
            {
                label: 'PostgreSQL',
                usedBytes: pgUsed,
                totalBytes: diskTotal,
                available: pgInstalled === 1,
            },
            {
                label: 'MySQL / MariaDB',
                usedBytes: mysqlUsed,
                totalBytes: diskTotal,
                available: mysqlInstalled === 1,
            },
        ];

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
                sections,
            },
        };
    } catch (e: any) {
        return { error: e.message };
    }
}
