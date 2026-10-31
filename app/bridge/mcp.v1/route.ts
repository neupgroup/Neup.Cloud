/*
::neup.documentation::bridge-mcp-v1-route
::title MCP Streamable HTTP Endpoint

::public

Provides the Model Context Protocol endpoint used by external applications.

::public end

::end
*/

import { NextRequest, NextResponse } from 'next/server';
import { applicationCreateTool, createApplicationTool } from './applications/create';
import { applicationsListTool, listApplicationsTool } from './applications/list';
import { applicationViewTool, viewApplicationTool } from './applications/view';
import { domainsListTool, listDomainsTool } from './domains/list';
import { serversListTool, listServersTool } from './servers/list';
import { getServerStatusTool, serverStatusTool } from './servers/single/status';
import { serverCommandLogTool, listServerCommandLogs } from './servers/single/commands/log';
import { serverFilesListTool, listServerFiles } from './servers/single/files/list';
import { serverFileViewTool, viewServerFile } from './servers/single/files/view';
import { authenticateRequest } from '@/services/auth/authentication';

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
const MCP_TOOLS = [
  applicationViewTool,
  applicationCreateTool,
  applicationsListTool,
  serversListTool,
  serverStatusTool,
  serverCommandLogTool,
  serverFilesListTool,
  serverFileViewTool,
  domainsListTool,
];
const MCP_TOOL_HANDLERS: Record<string, (input: Record<string, unknown>) => Promise<unknown>> = {
  applications_view: viewApplicationTool,
  applications_create: createApplicationTool,
  applications_list: listApplicationsTool,
  servers_list: listServersTool,
  servers_single_status: getServerStatusTool,
  servers_single_commands_log: listServerCommandLogs,
  servers_single_files_list: listServerFiles,
  servers_single_files_view: viewServerFile,
  domains_list: listDomainsTool,
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
async function handleMcpMessage(message: JsonRpcRequest, accountId: string): Promise<NextResponse> {
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
    return createJsonRpcResult(message.id, { tools: MCP_TOOLS });
  }

  if (message.method === 'tools/call') {
    return handleToolCall(message, accountId);
  }

  if (message.method.startsWith('notifications/')) {
    return new NextResponse(null, { status: 202, headers: RESPONSE_HEADERS });
  }

  return createMcpError('invalidMethod', `Method not found: ${message.method}`, 400, message.id);
}

// Dispatch one MCP tool call and serialize successful and failed tool results.
async function handleToolCall(message: JsonRpcRequest, accountId: string): Promise<NextResponse> {
  const params = message.params && typeof message.params === 'object'
    ? message.params as Record<string, unknown>
    : {};
  const toolName = params.name;
  if (typeof toolName !== 'string') {
    return createMcpError('invalidParams', 'Tool name is required.', 400, message.id);
  }

  const handler = MCP_TOOL_HANDLERS[toolName];
  if (!handler) {
    return createMcpError('toolNotExists', `Tool not found: ${toolName}`, 404, message.id);
  }

  const input = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
    ? params.arguments as Record<string, unknown>
    : {};
  if (toolName === 'servers_list') input.accountId = accountId;
  if (toolName === 'applications_list' && (typeof input.serverId === 'string' || typeof input.serverName === 'string')) input.accountId = accountId;
  if (toolName.startsWith('servers_single_')) input.accountId = accountId;

  try {
    const result = await handler(input);
    return createJsonRpcResult(message.id, {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
      isError: false,
    });
  } catch (error) {
    return createJsonRpcResult(message.id, {
      content: [{ type: 'text', text: error instanceof Error ? error.message : 'Tool execution failed.' }],
      isError: true,
    });
  }
}

// Accept MCP Streamable HTTP JSON-RPC requests at /bridge/mcp.v1/.
export async function POST(request: NextRequest) {
  const account = await authenticateRequest(request);
  if (!account) {
    return createMcpError('unauthorized', 'A valid x-auth header or auth cookie is required.', 401);
  }

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

    const responses = await Promise.all(messages.map(async (message) => {
      if (!message || typeof message !== 'object' || Array.isArray(message)) {
        return createMcpError('invalidRequest', 'Invalid JSON-RPC request.');
      }
      return handleMcpMessage(message as JsonRpcRequest, account.accountId);
    }));

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
