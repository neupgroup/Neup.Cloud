/*
::neup.documentation::bridge-api-v1-logger-route
::title Logger Activity Ingest Route

::public

Accepts logger events from external applications and stores them in the shared logger tables.

::public end

::end
*/

import { NextRequest, NextResponse } from 'next/server';

import { logActivity } from '@/services/logger/logger-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESPONSE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

type LoggerRequestBody = {
  projectId?: unknown;
  projectName?: unknown;
  type?: unknown;
  data?: unknown;
};

function readOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as LoggerRequestBody;

    const activity = await logActivity({
      projectId: readOptionalString(body.projectId),
      projectName: readOptionalString(body.projectName),
      type: readOptionalString(body.type) ?? 'info',
      data: body.data ?? {},
    });

    return NextResponse.json(
      {
        success: true,
        activity,
      },
      {
        status: 201,
        headers: RESPONSE_HEADERS,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to store logger activity.';
    const status = message.includes('required') ? 400 : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status,
        headers: RESPONSE_HEADERS,
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: RESPONSE_HEADERS,
  });
}
