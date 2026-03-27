import type { SupportedProvider } from '@/actions/intelligence/types';

export function ensureApiKey(value: string | undefined, provider: SupportedProvider): string {
  if (!value) {
    throw new Error(`Missing API key for ${provider}`);
  }

  return value;
}

export function extractText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (part && typeof part === 'object') {
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }

        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

export async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    const message =
      payload?.error?.message ||
      payload?.message ||
      payload?.error ||
      response.statusText;

    return typeof message === 'string' ? message : response.statusText;
  } catch {
    return response.statusText;
  }
}
