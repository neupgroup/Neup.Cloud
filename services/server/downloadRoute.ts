import { downloadFiles } from '@/services/server/downloadFiles';
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';

export async function handleDownloadPost(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const serverId = request.nextUrl.searchParams.get('server')?.trim() || cookieStore.get('selected_server')?.value;
        if (!serverId) {
            return NextResponse.json({ error: 'No server selected' }, { status: 400 });
        }
        const body = await request.json();
        const { paths, rootMode } = body;
        if (!paths || !Array.isArray(paths) || paths.length === 0) {
            return NextResponse.json({ error: 'No files selected' }, { status: 400 });
        }
        const result = await downloadFiles(serverId, paths, rootMode || false);
        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }
        if (!result.filePath || !result.fileName) {
            return NextResponse.json({ error: 'Download failed' }, { status: 500 });
        }
        const fileBuffer = await fs.readFile(result.filePath);
        await fs.unlink(result.filePath).catch(console.error);
        const contentType = result.fileName.endsWith('.zip')
            ? 'application/zip'
            : 'application/octet-stream';
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${result.fileName}"`,
                'Content-Length': fileBuffer.length.toString(),
            },
        });
    } catch (error: any) {
        console.error('Download error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
