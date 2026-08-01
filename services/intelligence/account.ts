'use server';

import { cookies } from 'next/headers';

const ACCOUNT_COOKIE_NAMES = [
  'accountId',
  'account_id',
  'neup_account_id',
  'selected_account',
  'selected_account_id',
  'working_profile',
];

function extractAccountIdFromJson(value: string): string | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const accountId =
      parsed.accountId ||
      parsed.account_id ||
      parsed.id ||
      parsed.workingProfile;

    return typeof accountId === 'string' && accountId.trim() ? accountId.trim() : null;
  } catch {
    return null;
  }
}

export async function getCurrentIntelligenceAccountId(): Promise<string> {
  const cookieStore = await cookies();

  for (const name of ACCOUNT_COOKIE_NAMES) {
    const value = cookieStore.get(name)?.value?.trim();
    if (value) return value;
  }

  for (const cookie of cookieStore.getAll()) {
    const value = cookie.value?.trim();
    if (!value || !(cookie.name.includes('user') || cookie.name.includes('session'))) {
      continue;
    }

    const accountId = extractAccountIdFromJson(value);
    if (accountId) return accountId;
  }

  throw new Error('Unable to resolve the current account for intelligence.');
}
