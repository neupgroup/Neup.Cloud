import { invokeModel } from '@/services/intelligence/model-client';
import { ensureIntelligenceTables, getIntelligenceDbPool } from '@/services/intelligence/db';

export interface OpenFlowExecutionInput {
  provider: string;
  model: string;
  apiKey: string;
  fallbackProvider: string | null;
  fallbackModel: string | null;
  fallbackApiKey: string | null;
  prompt: string;
  context: string;
  accountId: string;
}

export interface OpenFlowExecutionResult {
  success: boolean;
  response?: string;
  modelUsed?: string;
  provider?: string;
  error?: string;
  fallbackUsed?: boolean;
}

export async function executeOpenFlowRequest(
  input: OpenFlowExecutionInput
): Promise<OpenFlowExecutionResult> {
  try {
    const primaryApiKey = input.apiKey.trim();

    if (!primaryApiKey) {
      return {
        success: false,
        error: 'Primary API key is required',
      };
    }

    const fallbackEnabled = Boolean(input.fallbackProvider || input.fallbackModel || input.fallbackApiKey);

    if (fallbackEnabled && (!input.fallbackProvider || !input.fallbackModel || !input.fallbackApiKey)) {
      return {
        success: false,
        error: 'Fallback provider, model, and API key must all be provided when fallback is enabled',
      };
    }

    const fullPrompt = input.context
      ? `Context:\n${input.context}\n\nPrompt:\n${input.prompt}`
      : input.prompt;

    let result;
    let usedFallback = false;
    let lastError: Error | null = null;

    try {
      result = await invokeModel({
        provider: input.provider,
        model: input.model,
        prompt: fullPrompt,
        apiKey: primaryApiKey,
      });
    } catch (primaryError) {
      lastError = primaryError instanceof Error ? primaryError : new Error(String(primaryError));

      if (fallbackEnabled) {
        try {
          result = await invokeModel({
            provider: input.fallbackProvider,
            model: input.fallbackModel,
            prompt: fullPrompt,
            apiKey: input.fallbackApiKey as string,
          });
          usedFallback = true;
        } catch (fallbackError) {
          const fallbackErrorMsg = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';

          return {
            success: false,
            error: `Both primary and fallback models failed. Primary: ${lastError.message}. Fallback: ${fallbackErrorMsg}`,
          };
        }
      } else {
        return {
          success: false,
          error: `Primary model failed: ${lastError.message}`,
        };
      }
    }

    const tokenLast4 = primaryApiKey.slice(-4);

    await logOpenFlowUsage({
      accountId: input.accountId,
      tokenLast4,
      modelUsed: result.model,
      provider: result.provider,
    });

    return {
      success: true,
      response: result.responseText,
      modelUsed: result.model,
      provider: result.provider,
      fallbackUsed: usedFallback,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

async function logOpenFlowUsage(input: {
  accountId: string;
  tokenLast4: string;
  modelUsed: string;
  provider: string;
}) {
  try {
    await ensureIntelligenceTables();
    const db = await getIntelligenceDbPool();

    await db.query(
      `
        INSERT INTO "openflow_usage_log" (account_id, token_last4, model_used, provider, used_at)
        VALUES ($1, $2, $3, $4, NOW())
      `,
      [input.accountId, input.tokenLast4, input.modelUsed, input.provider]
    );
  } catch (error) {
    console.error('Failed to log OpenFlow usage:', error);
  }
}