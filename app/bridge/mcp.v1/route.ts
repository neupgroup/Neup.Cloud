/*
::neup.documentation::bridge-mcp-v1-route
::title MCP Streamable HTTP Endpoint

::public

Provides the Model Context Protocol endpoint used by external applications.

::public end

::end
*/

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MCP_PROTOCOL_VERSION = '2025-03-26';
const SUPPORTED_PROTOCOL_VERSIONS = new Set([
  '2025-03-26',
  '2024-11-05',
  '2024-10-07',
]);
const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
};

type JsonRpcRequest = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

// Build a JSON-RPC success response while preserving the caller's request id.
function createJsonRpcResult(id: unknown, result: Record<string, unknown>) {
  return NextResponse.json(
    { jsonrpc: '2.0', id, result },
    { headers: RESPONSE_HEADERS }
  );
}

// Build an MCP error response using the endpoint's public error format.
function createMcpError(code: string, description: string, status = 400, id?: unknown) {
  return NextResponse.json(
    {
      ...(id !== undefined ? { jsonrpc: '2.0', id } : {}),
      error: { code, description },
    },
    { status, headers: RESPONSE_HEADERS }
  );
}

// Handle one JSON-RPC message from a Streamable HTTP MCP client.
function handleMcpMessage(message: JsonRpcRequest): NextResponse {
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return createMcpError('invalidRequest', 'Invalid JSON-RPC request.', 400, message.id);
  }

  if (message.method === 'notifications/initialized' || message.method === 'notifications/cancelled') {
    return new NextResponse(null, { status: 202, headers: RESPONSE_HEADERS });
  }

  if (message.method === 'initialize') {
    const params = message.params && typeof message.params === 'object'
      ? message.params as Record<string, unknown>
      : {};
    const requestedVersion = typeof params.protocolVersion === 'string'
      ? params.protocolVersion
      : MCP_PROTOCOL_VERSION;

    return createJsonRpcResult(message.id, {
      protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.has(requestedVersion)
        ? requestedVersion
        : MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'neup-cloud', version: '1.0.0' },
    });
  }

  if (message.method === 'ping') {
    return createJsonRpcResult(message.id, {});
  }

  if (message.method === 'tools/list') {
    return createJsonRpcResult(message.id, { tools: [] });
  }

  if (message.method === 'tools/call') {
    return createMcpError('toolNotExists', 'No MCP tools are registered yet.', 404, message.id);
  }

  if (message.method.startsWith('notifications/')) {
    return new NextResponse(null, { status: 202, headers: RESPONSE_HEADERS });
  }

  return createMcpError('invalidMethod', `Method not found: ${message.method}`, 400, message.id);
}

// Accept MCP Streamable HTTP JSON-RPC requests at /bridge/mcp.v1/.
export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return createMcpError('invalidContentType', 'Content-Type must be application/json.', 415);
  }

  try {
    const payload: unknown = await request.json();
    const messages = Array.isArray(payload) ? payload : [payload];

    if (messages.length === 0) {
      return createMcpError('invalidRequest', 'A JSON-RPC message is required.');
    }

    const responses = messages.map((message) => {
      if (!message || typeof message !== 'object' || Array.isArray(message)) {
        return createMcpError('invalidRequest', 'Invalid JSON-RPC request.');
      }
      return handleMcpMessage(message as JsonRpcRequest);
    });

    if (responses.length === 1) return responses[0];

    const responseBodies = await Promise.all(responses.map(async (response) => {
      if (response.status === 202) return null;
      return response.json();
    }));
    const body = responseBodies.filter((entry) => entry !== null);

    if (body.length === 0) {
      return new NextResponse(null, { status: 202, headers: RESPONSE_HEADERS });
    }

    return NextResponse.json(body, { headers: RESPONSE_HEADERS });
  } catch {
    return createMcpError('invalidJson', 'Request body must contain valid JSON.');
  }
}

// Tell clients to send MCP operations with POST at this endpoint.
export async function GET() {
  return NextResponse.json(
    {
      error: {
        code: 'invalidMethod',
        description: 'MCP Streamable HTTP clients must send POST requests to this endpoint.',
      },
    },
    { status: 405, headers: { ...RESPONSE_HEADERS, Allow: 'POST' } }
  );
}

// This endpoint does not create server-side sessions, so no session can be closed.
export async function DELETE() {
  return NextResponse.json(
    {
      error: {
        code: 'invalidMethod',
        description: 'This MCP endpoint does not use server-side sessions.',
      },
    },
    { status: 405, headers: { ...RESPONSE_HEADERS, Allow: 'POST' } }
  );
}
