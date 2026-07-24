'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';
import type { DatabaseInstallation, EngineStatus, DatabaseInstance } from './engine-types';

/**
 * Check which database engines are installed on the server
 */
export async function checkDatabaseInstallation(serverId: string): Promise<DatabaseInstallation> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username) {
        throw new Error('Server not found or missing credentials.');
    }

    try {
        // 1. Read the .database tracking file
        let trackDetails: Record<string, EngineStatus> = {};
        const trackResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            'cat ~/.database 2>/dev/null || echo "{}"',
            undefined,
            undefined,
            true // skipSwap - Don't use swap space for database operations
        );

        if (trackResult.code === 0) {
            try {
                // Find potential JSON in output (strip banners/noise)
                const match = trackResult.stdout.match(/\{[\s\S]*\}/);
                if (match) {
                    trackDetails = JSON.parse(match[0]);
                }
            } catch (e) {
                console.error('Failed to parse .database file JSON', e);
            }
        }

        // 2. Cross-verify with system status
        const engines = ['mariadb', 'postgres'];
        const finalDetails: Record<string, EngineStatus> = { ...trackDetails };

        for (const engine of engines) {
            const checkCmd = engine === 'mariadb' ? 'mysql --version' : 'psql --version';
            const sysResult = await runCommandOnServer(
                server.publicIp,
                server.username,
                server.privateKey,
                checkCmd,
                undefined,
                undefined,
                true // skipSwap - Don't use swap space for database operations
            );

            if (sysResult.code === 0) {
                // In system but maybe not in JSON
                if (!finalDetails[engine] || finalDetails[engine].status !== 'installed') {
                    // Improved version parsing for MariaDB and standard MySQL/Postgres
                    const versionMatch = sysResult.stdout.match(/Distrib\s+([\d\.]+)/)
                        || sysResult.stdout.match(/(\d+\.\d+)/);

                    finalDetails[engine] = {
                        status: 'installed',
                        version: versionMatch ? versionMatch[1] : 'detected',
                        installed_on: finalDetails[engine]?.installed_on || new Date().toISOString(),
                    };
                }
            } else if (finalDetails[engine]?.status === 'installed') {
                // In JSON but deleted from system
                finalDetails[engine].status = 'cancelled';
            }
        }

        return {
            installed: Object.values(finalDetails).some(d => d.status === 'installed'),
            details: finalDetails
        };
    } catch (error) {
        console.error('Error checking database installation:', error);
        return { installed: false, details: {} };
    }
}

/**
 * Install a database engine (MariaDB or PostgreSQL)
 */
export async function installDatabaseEngine(serverId: string, engine: 'mariadb' | 'postgres'): Promise<{ success: boolean; message: string }> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username) {
        throw new Error('Server not found or missing credentials.');
    }

    try {
        // PRODUCTION-GRADE INSTALLATION: Using MariaDB for reliability
        let installCmd = "";

        if (engine === 'mariadb') {
            installCmd = `
                sudo DEBIAN_FRONTEND=noninteractive apt-get update && \\
                sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mariadb-server mariadb-client && \\
                echo "[mysqld]
# Optimized for No-Swap Environment
performance_schema = OFF
innodb_buffer_pool_size = 64M
innodb_log_file_size = 16M
max_connections = 100" | sudo tee /etc/mysql/mariadb.conf.d/99-neup-cloud.cnf && \\
                sudo systemctl restart mariadb
            `;
        } else {
            installCmd = `
                sudo DEBIAN_FRONTEND=noninteractive apt-get update && \\
                sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib && \\
                sudo sed -i "s/^#\\?shared_buffers = .*/shared_buffers = 64MB/" /etc/postgresql/*/main/postgresql.conf && \\
                sudo sed -i "s/^#\\?max_connections = .*/max_connections = 100/" /etc/postgresql/*/main/postgresql.conf && \\
                sudo systemctl restart postgresql
            `;
        }

        const installResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            installCmd,
            undefined,
            undefined,
            true // skipSwap - Don't use swap space for database operations
        );

        if (installResult.code !== 0) {
            return { success: false, message: `System installation failed: ${installResult.stderr}` };
        }

        // Fetch current file content to merge
        let currentDetails: Record<string, EngineStatus> = {};
        const checkResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            'cat ~/.database 2>/dev/null || echo "{}"',
            undefined,
            undefined,
            true // skipSwap - Don't use swap space for database operations
        );

        if (checkResult.code === 0) {
            try {
                const match = checkResult.stdout.match(/\{[\s\S]*\}/);
                if (match) currentDetails = JSON.parse(match[0]);
            } catch (e) { }
        }

        // Get actual version installed (handles MariaDB reporting)
        const versionCmd = engine === 'mariadb' ? 'mysql --version' : 'psql --version';
        const versionResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            versionCmd,
            undefined,
            undefined,
            true // skipSwap - Don't use swap space for database operations
        );

        const versionMatch = versionResult.stdout.match(/Distrib\s+([\d\.]+)/)
            || versionResult.stdout.match(/(\d+\.\d+)/);

        currentDetails[engine] = {
            status: 'installed',
            version: versionMatch ? versionMatch[1] : (engine === 'mariadb' ? '10.x' : '14'),
            installed_on: new Date().toISOString(),
        };

        const jsonString = JSON.stringify(currentDetails, null, 2);

        // Save to hidden file
        const writeResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `cat <<EOF > ~/.database
${jsonString}
EOF`,
            undefined,
            undefined,
            true // skipSwap - Don't use swap space for database operations
        );

        if (writeResult.code !== 0) {
            throw new Error(`Failed to write .database track file: ${writeResult.stderr}`);
        }

        return { success: true, message: `${engine.toUpperCase()} installation and verification completed successfully.` };
    } catch (error: any) {
        console.error('Error installing database engine:', error);
        return { success: false, message: error.message || 'Installation failed.' };
    }
}

/**
 * List all databases across all installed engines
 */
export async function listAllDatabases(serverId: string): Promise<DatabaseInstance[]> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username) {
        throw new Error('Server not found or missing credentials.');
    }

    const instances: DatabaseInstance[] = [];
    const installation = await checkDatabaseInstallation(serverId);

    // List MariaDB Databases
    if (installation.details['mariadb']?.status === 'installed') {
        try {
            const mysqlResult = await runCommandOnServer(
                server.publicIp,
                server.username,
                server.privateKey,
                `sudo mysql -e "SHOW DATABASES;" | grep -v -E "Database|information_schema|performance_schema|mysql|sys"`,
                undefined,
                undefined,
                true // skipSwap - Don't use swap space for database operations
            );

            if (mysqlResult.code === 0) {
                const dbs = mysqlResult.stdout.trim().split('\n').filter(Boolean);
                dbs.forEach(db => {
                    instances.push({
                        name: db.trim(),
                        engine: 'mariadb'
                    });
                });
            }
        } catch (e) {
            console.error('Failed to list MariaDB databases', e);
        }
    }

    // List PostgreSQL Databases
    if (installation.details['postgres']?.status === 'installed') {
        try {
            const pgResult = await runCommandOnServer(
                server.publicIp,
                server.username,
                server.privateKey,
                `sudo -u postgres psql -t -c "SELECT datname FROM pg_database WHERE datistemplate = false AND datname != 'postgres';"`,
                undefined,
                undefined,
                true // skipSwap - Don't use swap space for database operations
            );

            if (pgResult.code === 0) {
                const dbs = pgResult.stdout.trim().split('\n').filter(Boolean);
                dbs.forEach(db => {
                    instances.push({
                        name: db.trim(),
                        engine: 'postgres'
                    });
                });
            }
        } catch (e) {
            console.error('Failed to list Postgres databases', e);
        }
    }

    return instances;
}
