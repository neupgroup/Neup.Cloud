/*
::neup.documentation::api-ai-omniroute
::title OmniRoute AI Endpoint
::api POST /api/intelligence/omniroute

Proxies a chat completion request to the configured OmniRoute server.

::public

Send `{ model, messages }` using OpenAI chat-completion message roles. The optional
`apiKey` overrides `OMNIROUTE_API_KEY` for the upstream OmniRoute request.

::public end

::end
*/

import { NextRequest, NextResponse } from 'next/server';

import { requestOmniRouteCompletion } from '@/core/intelligence/omniroute';
import type { DirectAiMessage } from '@/core/intelligence/_types';
import { getEnvVariable } from '@/core/helpers/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OmniRouteRequestBody = {
  apiKey?: unknown;
  model?: unknown;
  messages?: unknown;
  temperature?: unknown;
  maxTokens?: unknown;
  max_tokens?: unknown;
};

function parseMessages(value: unknown): DirectAiMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const messages = value.map((message) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      return null;
    }

    const candidate = message as { role?: unknown; content?: unknown };
    if (
      (candidate.role !== 'system' && candidate.role !== 'user' && candidate.role !== 'assistant') ||
      typeof candidate.content !== 'string' ||
      !candidate.content.trim()
    ) {
      return null;
    }

    return { role: candidate.role, content: candidate.content } as DirectAiMessage;
  });

  return messages.every(Boolean) ? (messages as DirectAiMessage[]) : null;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export async function POST(request: NextRequest) {
  let body: OmniRouteRequestBody;

  try {
    body = (await request.json()) as OmniRouteRequestBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const model = body && typeof body.model === 'string' ? body.model.trim() : '';
  const messages = parseMessages(body?.messages);

  if (!model || !messages) {
    return NextResponse.json(
      { success: false, error: 'model and a non-empty messages array are required.' },
      { status: 400 },
    );
  }

  const requestApiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
  const apiKey = requestApiKey || getEnvVariable('OMNIROUTE_API_KEY') || '';

  try {
    const result = await requestOmniRouteCompletion({
      apiKey,
      model,
      messages,
      temperature: readOptionalNumber(body.temperature),
      maxTokens: readOptionalNumber(body.maxTokens ?? body.max_tokens),
    });

    return NextResponse.json({ success: true, response: result.text, model, raw: result.raw }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'OmniRoute request failed.' },
      { status: 502 },
    );
  }
}
