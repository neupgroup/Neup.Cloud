import { NextRequest } from 'next/server';
import { generateDatabaseBackup, getDatabaseDetails } from '@/services/database/database-runtime';
import { parseDatabaseRouteId, resolveSelectedServerId } from '../../../route-helpers';

const BACKUP_MODES = new Set(['full', 'schema']);

function jsonError(message: string, status: number) {
    return Response.json({ success: false, message }, { status });
}

function safeDownloadName(filename: string) {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const serverId = await resolveSelectedServerId(Promise.resolve({
        selectedServer: request.nextUrl.searchParams.get('selectedServer') ?? undefined,
    }));
    const mode = request.nextUrl.searchParams.get('mode') ?? 'full';

    if (!serverId) {
        return jsonError('A selected server is required.', 400);
    }

    if (!BACKUP_MODES.has(mode)) {
        return jsonError('Invalid backup mode.', 400);
    }

    const parsedId = parseDatabaseRouteId(id);
    if (!parsedId) {
        return jsonError('Invalid database identifier.', 400);
    }

    const { engine, dbName } = parsedId;
    const backupMode = mode as 'full' | 'schema';

    try {
        await getDatabaseDetails(serverId, engine, dbName);
    } catch (error) {
        return jsonError('Database not found.', 404);
    }

    try {
        const result = await generateDatabaseBackup(serverId, engine, dbName, backupMode);

        if (!result.success || !result.content) {
            return jsonError(result.message || 'Failed to generate backup.', 500);
        }

        const filename = safeDownloadName(result.filename || `${dbName}_${backupMode}_backup.sql`);

        return new Response(result.content, {
            status: 200,
            headers: {
                'Content-Type': 'application/sql; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error: any) {
        return jsonError(error.message || 'Failed to generate backup.', 500);
    }
}
