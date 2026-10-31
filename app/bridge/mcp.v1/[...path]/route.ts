import { NextResponse } from 'next/server';

const RESPONSE_HEADERS = { 'Cache-Control': 'no-store' };

// Return a consistent error when an application connects to an unknown MCP path.
function createUnknownPathResponse() {
  return NextResponse.json(
    {
      error: {
        code: 'pathNotExists',
        description: 'The requested MCP endpoint path does not exist.',
      },
    },
    { status: 404, headers: RESPONSE_HEADERS }
  );
}

// Reject unsupported request methods on unknown MCP paths.
export async function GET() {
  return createUnknownPathResponse();
}

// Reject POST requests sent to unknown MCP paths.
export async function POST() {
  return createUnknownPathResponse();
}

// Reject PUT requests sent to unknown MCP paths.
export async function PUT() {
  return createUnknownPathResponse();
}

// Reject PATCH requests sent to unknown MCP paths.
export async function PATCH() {
  return createUnknownPathResponse();
}

// Reject DELETE requests sent to unknown MCP paths.
export async function DELETE() {
  return createUnknownPathResponse();
}

// Reject OPTIONS requests sent to unknown MCP paths.
export async function OPTIONS() {
  return createUnknownPathResponse();
}
