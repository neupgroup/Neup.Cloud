import { after, NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';

import { ensureIntelligenceTables, getIntelligenceDbPool } from '@/lib/intelligence/db';
import { invokeModel } from '@/lib/intelligence/model-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESPONSE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, userid, tokenKey, tokenkey, x-userid, x-tokenkey',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
};

interface ParsedInput {
  accountId: string;
  tokenKey: string;
  accessIdentifier: string;
  requestedModel: string;
  parameters: Record<string, string>;
  context: string;
  userQuery: string;
}

interface IntelligenceAccessRow {
  id: number;
  prompt_id: string;
  account_id: string;
  token_hash: string;
  primaryModel: string | null;
  fallbackModel: string | null;
  primaryModelConfig: unknown;
  fallbackModelConfig: unknown;
  primaryAccessKey: number | null;
  fallbackAccessKey: number | null;
  primaryAccessTokenKey: string | null;
  fallbackAccessTokenKey: string | null;
  maxTokens: number | null;
  defPrompt: string | null;
  balance: number;
}

interface BuiltPrompt {
  renderedPrompt: string;
  hasMasterPrompt: boolean;
  hasContext: boolean;
  hasQuery: boolean;
}

interface StoredModelConfig {
  id: number;
  title: string;
  provider: string;
  model: string;
  description: string | null;
  price: Record<string, unknown>;
}

function buildStoredContext(rawContext: string, metadata: Record<string, unknown>): string {
  let requestContext: unknown = rawContext;

  if (rawContext.trim()) {
    try {
      requestContext = JSON.parse(rawContext);
    } catch {
      requestContext = rawContext;
    }
  }

  return JSON.stringify({
    requestContext,
    ...metadata,
  });
}

const RESERVED_QUERY_KEYS = new Set([
  'accessid',
  'prompt',
  'model',
  'parameter',
  'parameters',
  'context',
  'query',
  'input',
  'text',
  'message',
]);

function successResponse(response: string, status = 200) {
  return NextResponse.json(
    {
      status: 'pass',
      response,
    },
    {
      status,
      headers: RESPONSE_HEADERS,
    }
  );
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      status: 'pass',
      error: message,
    },
    {
      status,
      headers: RESPONSE_HEADERS,
    }
  );
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeParameterValues(value: unknown): Record<string, string> {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalizeParameterValues(parsed);
    } catch {
      return { value };
    }
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>((accumulator, [key, entryValue]) => {
    if (entryValue === undefined || entryValue === null) {
      return accumulator;
    }

    accumulator[key] = String(entryValue);
    return accumulator;
  }, {});
}

function extractQueryParameters(searchParams: URLSearchParams): Record<string, string> {
  const parameters: Record<string, string> = {};

  searchParams.forEach((value, key) => {
    if (!RESERVED_QUERY_KEYS.has(key)) {
      parameters[key] = value;
    }
  });

  return parameters;
}

function stringifyContext(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return value;
    }
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildPrompt(
  masterPrompt: string | null,
  userQuery: string,
  parameters: Record<string, string>,
  context: string
): BuiltPrompt {
  const baseMasterPrompt = (masterPrompt || '').trim();
  const substitutedMasterPrompt = baseMasterPrompt.replace(
    /\{\{\s*([\w.-]+)\s*\}\}/g,
    (_, key: string) => parameters[key] ?? ''
  ).trim();

  const sections: string[] = [];

  if (substitutedMasterPrompt) {
    sections.push(`Master Prompt:\n${substitutedMasterPrompt}`);
  }

  if (context.trim()) {
    sections.push(`Context:\n${context.trim()}`);
  }

  if (userQuery.trim()) {
    sections.push(`Query:\n${userQuery.trim()}`);
  }

  if (Object.keys(parameters).length > 0 && substitutedMasterPrompt === baseMasterPrompt) {
    sections.push(`Parameters:\n${JSON.stringify(parameters, null, 2)}`);
  }

  return {
    renderedPrompt: sections.join('\n\n').trim(),
    hasMasterPrompt: Boolean(substitutedMasterPrompt),
    hasContext: Boolean(context.trim()),
    hasQuery: Boolean(userQuery.trim()),
  };
}

function normalizeModelName(value: string | null | undefined): string {
  return (value || '').trim();
}

function normalizeStoredModelConfig(value: unknown): StoredModelConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const provider = typeof record.provider === 'string' ? record.provider.trim().toLowerCase() : '';
  const model = typeof record.model === 'string' ? record.model.trim() : '';

  if (!title || !provider || !model) {
    return null;
  }

  return {
    id: Number.isFinite(Number(record.id)) ? Number(record.id) : 0,
    title,
    provider,
    model,
    description: typeof record.description === 'string' ? record.description : null,
    price: record.price && typeof record.price === 'object' && !Array.isArray(record.price)
      ? (record.price as Record<string, unknown>)
      : {},
  };
}

function getModelIdentifier(config: StoredModelConfig | null, fallbackValue: string | null): string {
  if (config) {
    return `${config.provider}:${config.model}`;
  }

  return normalizeModelName(fallbackValue);
}

function modelMatchesRequest(requestedModel: string, config: StoredModelConfig | null, fallbackValue: string | null): boolean {
  const normalizedRequestedModel = normalizeModelName(requestedModel).toLowerCase();

  if (!normalizedRequestedModel) {
    return false;
  }

  const candidates = [
    getModelIdentifier(config, fallbackValue).toLowerCase(),
    config?.model?.toLowerCase() || '',
    fallbackValue?.toLowerCase() || '',
  ].filter(Boolean);

  return candidates.includes(normalizedRequestedModel);
}

function readPriceNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(source[key]);

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function estimateModelCost(
  price: Record<string, unknown>,
  inputTokens: number,
  outputTokens: number,
  usageTokens: number
): number | null {
  const inputPer1M = readPriceNumber(price, ['inputPer1M', 'input_per_1m', 'input']);
  const outputPer1M = readPriceNumber(price, ['outputPer1M', 'output_per_1m', 'output']);
  const flatPer1M = readPriceNumber(price, ['per1M', 'per_1m', 'totalPer1M']);
  const inputPerToken = readPriceNumber(price, ['inputPerToken', 'input_per_token']);
  const outputPerToken = readPriceNumber(price, ['outputPerToken', 'output_per_token']);
  const flatPerToken = readPriceNumber(price, ['perToken', 'per_token']);

  if (inputPerToken !== null || outputPerToken !== null) {
    return Number(
      (
        (inputTokens * (inputPerToken ?? flatPerToken ?? 0)) +
        (outputTokens * (outputPerToken ?? flatPerToken ?? 0))
      ).toFixed(8)
    );
  }

  if (inputPer1M !== null || outputPer1M !== null) {
    return Number(
      (
        ((inputTokens / 1_000_000) * (inputPer1M ?? flatPer1M ?? 0)) +
        ((outputTokens / 1_000_000) * (outputPer1M ?? flatPer1M ?? 0))
      ).toFixed(8)
    );
  }

  if (flatPer1M !== null) {
    return Number(((usageTokens / 1_000_000) * flatPer1M).toFixed(8));
  }

  if (flatPerToken !== null) {
    return Number((usageTokens * flatPerToken).toFixed(8));
  }

  return null;
}

function tokenMatchesHash(tokenKey: string, storedHash: string): boolean {
  const normalizedStoredHash = storedHash.trim();
  const sha256Hex = createHash('sha256').update(tokenKey).digest('hex');
  const sha256Base64 = createHash('sha256').update(tokenKey).digest('base64');
  const candidates = [
    tokenKey,
    sha256Hex,
    sha256Base64,
    `sha256:${sha256Hex}`,
    `sha256:${sha256Base64}`,
  ];

  return candidates.some((candidate) => safeEquals(candidate, normalizedStoredHash));
}

async function parseInput(request: NextRequest): Promise<ParsedInput> {
  let body: unknown = null;

  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.toLowerCase().includes('application/json')) {
      throw new Error('Invalid Content-Type. Send the request as application/json.');
    }

    const rawBody = await request.text();

    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        throw new Error('Invalid JSON body. Send raw JSON like {"context":"","query":"who are you?"}.');
      }
    }
  }

  const queryParameters = request.nextUrl.searchParams;

  if (request.method === 'POST' && body !== null && (typeof body !== 'object' || Array.isArray(body))) {
    throw new Error('Request body must be a raw JSON object');
  }

  const parsedBody: Record<string, unknown> =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const accountId =
    request.headers.get('userid') ||
    request.headers.get('userId') ||
    request.headers.get('x-userid') ||
    '';
  const tokenKey =
    request.headers.get('tokenkey') ||
    request.headers.get('tokenKey') ||
    request.headers.get('x-tokenkey') ||
    '';

  const accessIdentifier = String(
    parsedBody?.accessid ||
    parsedBody?.accessId ||
    queryParameters.get('accessid') ||
    queryParameters.get('accessId') ||
    queryParameters.get('prompt') ||
    ''
  ).trim();
  const requestedModel = String(parsedBody?.model || queryParameters.get('model') || '').trim();
  const userQuery = String(
    parsedBody?.query ||
    parsedBody?.input ||
    parsedBody?.text ||
    parsedBody?.message ||
    ''
  ).trim();

  const parameters = {
    ...extractQueryParameters(queryParameters),
    ...normalizeParameterValues(queryParameters.get('parameter')),
    ...normalizeParameterValues(queryParameters.get('parameters')),
    ...normalizeParameterValues(parsedBody?.parameter),
    ...normalizeParameterValues(parsedBody?.parameters),
  };

  const context = stringifyContext(
    parsedBody?.context ||
    (Object.keys(parameters).length > 0 ? parameters : '')
  );

  return {
    accountId: accountId.trim(),
    tokenKey: tokenKey.trim(),
    accessIdentifier,
    requestedModel,
    parameters,
    context,
    userQuery,
  };
}

async function findAccessRow(accountId: string, accessIdentifier: string): Promise<IntelligenceAccessRow | null> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<IntelligenceAccessRow>(
    `
      SELECT
        ia.id,
        ia.prompt_id,
        ia.account_id,
        ia.token_hash,
        ia."primaryModel",
        ia."fallbackModel",
        ia."primaryModelConfig",
        ia."fallbackModelConfig",
        ia."primaryAccessKey",
        ia."fallbackAccessKey",
        primary_token."key" AS "primaryAccessTokenKey",
        fallback_token."key" AS "fallbackAccessTokenKey",
        ia."maxTokens",
        ia."defPrompt",
        ia.balance
      FROM "intelligenceAccess" ia
      LEFT JOIN "accessTokens" primary_token
        ON primary_token.id = ia."primaryAccessKey"
      LEFT JOIN "accessTokens" fallback_token
        ON fallback_token.id = ia."fallbackAccessKey"
      WHERE ia.account_id = $1 AND ia.prompt_id = $2
      ORDER BY ia.id DESC
      LIMIT 1
    `,
    [accountId, accessIdentifier]
  );

  return result.rows[0] || null;
}

async function finalizeRequestLog(input: {
  accessId: number;
  query: string;
  context: string;
  modal: string;
  responseText: string;
  usageTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number | null;
  currentBalance: number;
}) {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const tokensToDeduct = Math.max(1, input.usageTokens || 0);

  const updateResult = await db.query<{ balance: number }>(
    `
      UPDATE "intelligenceAccess"
      SET balance = GREATEST(balance - $1, 0)
      WHERE id = $2
      RETURNING balance
    `,
    [tokensToDeduct, input.accessId]
  );

  const remainingBalance = updateResult.rows[0]?.balance ?? Math.max(input.currentBalance - tokensToDeduct, 0);

  await db.query(
    `
      INSERT INTO "intelligenceLog" (access_id, query, response, context, modal, balance)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      input.accessId,
      input.query,
      input.responseText,
      buildStoredContext(input.context, {
        status: 'success',
        usageTokens: input.usageTokens,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        estimatedCost: input.estimatedCost,
      }),
      input.modal,
      remainingBalance,
    ]
  );
}

async function logFailedRequest(input: {
  accessId: number;
  query: string;
  context: string;
  modal: string;
  errorMessage: string;
  balance: number;
}) {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  await db.query(
    `
      INSERT INTO "intelligenceLog" (access_id, query, response, context, modal, balance)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      input.accessId,
      input.query,
      `ERROR: ${input.errorMessage}`,
      buildStoredContext(input.context, {
        status: 'error',
        usageTokens: 0,
        estimatedCost: null,
      }),
      input.modal,
      input.balance,
    ]
  );
}

async function handleRequest(request: NextRequest) {
  let input: ParsedInput;

  try {
    input = await parseInput(request);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Invalid request body', 400);
  }

  if (!input.accountId) {
    return errorResponse('Missing userid header', 400);
  }

  if (!input.tokenKey) {
    return errorResponse('Missing tokenKey header', 400);
  }

  if (!input.accessIdentifier) {
    return errorResponse('Invalid request parameters. Missing accessid.', 400);
  }

  const access = await findAccessRow(input.accountId, input.accessIdentifier);

  if (!access) {
    return errorResponse('Invalid userid or accessid. No intelligence access was found for this account and access ID.', 404);
  }

  if (!tokenMatchesHash(input.tokenKey, access.token_hash)) {
    return errorResponse('Invalid tokenKey for this intelligence access.', 401);
  }

  if (Number(access.balance) <= 0) {
    return errorResponse('Insufficient balance for this intelligence access.', 402);
  }

  const primaryModel = normalizeModelName(access.primaryModel);
  const fallbackModel = normalizeModelName(access.fallbackModel);
  const primaryModelConfig = normalizeStoredModelConfig(access.primaryModelConfig);
  const fallbackModelConfig = normalizeStoredModelConfig(access.fallbackModelConfig);
  const requestedModel = normalizeModelName(input.requestedModel);

  const promptPayload = buildPrompt(access.defPrompt, input.userQuery, input.parameters, input.context);

  if (!promptPayload.renderedPrompt) {
    if (request.method !== 'POST') {
      return errorResponse(
        'Invalid request method for this payload. Send a POST request with a raw JSON body containing query and/or context.',
        400
      );
    }

    return errorResponse(
      'Invalid request parameters. No masterPrompt is saved for this access, and the JSON body did not include query or context.',
      400
    );
  }

  const modelCandidates = requestedModel
    ? [
        modelMatchesRequest(requestedModel, primaryModelConfig, primaryModel)
          ? {
              provider: primaryModelConfig?.provider || null,
              model: primaryModelConfig?.model || primaryModel,
              identifier: getModelIdentifier(primaryModelConfig, primaryModel),
              price: primaryModelConfig?.price || {},
              apiKey: access.primaryAccessTokenKey,
              source: 'primary' as const,
            }
          : null,
        modelMatchesRequest(requestedModel, fallbackModelConfig, fallbackModel)
          ? {
              provider: fallbackModelConfig?.provider || null,
              model: fallbackModelConfig?.model || fallbackModel,
              identifier: getModelIdentifier(fallbackModelConfig, fallbackModel),
              price: fallbackModelConfig?.price || {},
              apiKey: access.fallbackAccessTokenKey,
              source: 'fallback' as const,
            }
          : null,
      ].filter(Boolean)
    : [
        (primaryModelConfig?.model || primaryModel)
          ? {
              provider: primaryModelConfig?.provider || null,
              model: primaryModelConfig?.model || primaryModel,
              identifier: getModelIdentifier(primaryModelConfig, primaryModel),
              price: primaryModelConfig?.price || {},
              apiKey: access.primaryAccessTokenKey,
              source: 'primary' as const,
            }
          : null,
        (fallbackModelConfig?.model || fallbackModel)
          ? {
              provider: fallbackModelConfig?.provider || null,
              model: fallbackModelConfig?.model || fallbackModel,
              identifier: getModelIdentifier(fallbackModelConfig, fallbackModel),
              price: fallbackModelConfig?.price || {},
              apiKey: access.fallbackAccessTokenKey,
              source: 'fallback' as const,
            }
          : null,
      ].filter(Boolean);

  if (requestedModel && modelCandidates.length === 0) {
    return errorResponse('Requested model does not match configured primaryModel or fallbackModel', 403);
  }

  if (modelCandidates.length === 0) {
    return errorResponse('No primaryModel or fallbackModel configured for this access', 400);
  }

  const usableCandidates = modelCandidates.filter(
    (candidate): candidate is {
      provider: string | null;
      model: string;
      identifier: string;
      price: Record<string, unknown>;
      apiKey: string;
      source: 'primary' | 'fallback';
    } =>
      Boolean(candidate?.model && candidate?.apiKey)
  );

  if (usableCandidates.length === 0) {
    return errorResponse('No access token configured for the available models', 400);
  }

  let lastErrorMessage = 'Failed to generate response';

  for (const candidate of usableCandidates) {
    try {
      const modelResult = await invokeModel({
        provider: candidate.provider,
        model: candidate.model,
        prompt: promptPayload.renderedPrompt,
        maxTokens: access.maxTokens,
        apiKey: candidate.apiKey,
      });

      const estimatedCost = estimateModelCost(
        candidate.price,
        modelResult.inputTokens,
        modelResult.outputTokens,
        modelResult.usageTokens
      );

      after(async () => {
        try {
          await finalizeRequestLog({
            accessId: access.id,
            query: promptPayload.renderedPrompt,
            context: input.context,
            modal: candidate.identifier,
            responseText: modelResult.responseText,
            usageTokens: modelResult.usageTokens,
            inputTokens: modelResult.inputTokens,
            outputTokens: modelResult.outputTokens,
            estimatedCost,
            currentBalance: Number(access.balance),
          });
        } catch (error) {
          console.error('Failed to finalize intelligence log:', error);
        }
      });

      return successResponse(modelResult.responseText);
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : 'Failed to generate response';
    }
  }

  after(async () => {
    try {
      await logFailedRequest({
        accessId: access.id,
        query: promptPayload.renderedPrompt,
        context: input.context,
        modal: usableCandidates.map((candidate) => candidate.identifier).join(' -> '),
        errorMessage: lastErrorMessage,
        balance: Number(access.balance),
      });
    } catch (logError) {
      console.error('Failed to log intelligence error:', logError);
    }
  });

  return errorResponse(lastErrorMessage, 500);
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

export async function OPTIONS() {
  await ensureIntelligenceTables();

  return new NextResponse(null, {
    status: 204,
    headers: RESPONSE_HEADERS,
  });
}
