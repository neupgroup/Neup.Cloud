import { NextRequest, NextResponse } from 'next/server';

import { executeRandomAiResponse, parseModelCandidates } from '@/services/intelligence/random-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      context?: string;
      model?: unknown;
      models?: unknown;
    };

    const modelCandidates = parseModelCandidates(body.models ?? body.model);

    const result = await executeRandomAiResponse({
      prompt: readStringValue(body.prompt),
      context: readStringValue(body.context),
      models: modelCandidates,
    });

    const { statusCode, ...responseBody } = result;

    return NextResponse.json(responseBody, {
      status: statusCode ?? (result.success ? 200 : 500),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute AI response request',
      },
      { status: 500 }
    );
  }
}