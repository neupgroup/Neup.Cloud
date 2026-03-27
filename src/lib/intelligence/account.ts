import { cookies } from 'next/headers';

export async function getCurrentIntelligenceAccountId(): Promise<string> {
  const cookieStore = await cookies();
  const accountId = cookieStore.get('auth_account_id')?.value?.trim();

  return accountId || '1';
}
