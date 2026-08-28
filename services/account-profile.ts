/*
::neup.documentation::services-account-profile
::title Account Profile Service

::public

Keeps local account profile records synchronized with Neup Account.

::public end

::private

`ensureAccountProfile()` checks the local `accounts` table first. If the row is
missing or lacks required profile fields, it fetches `displayName`,
`displayImage`, and `neupid` through `logica.account.lookup.byId(accountId).get(...)`,
stores the values locally, optionally notifies Neup Account through configured
environment hooks, and returns the database-backed row.

::private end

::end
*/

import { prisma } from '#/core/database/prisma';
import logica from '#/logica';
import { getCookie } from '#/core/helpers/cookie';

export type AccountProfile = {
  id: string;
  displayName: string | null;
  displayImage: string | null;
  neupid: string | null;
};

type EnsureAccountProfileInput = {
  accountId: string;
  neupid?: string | null;
  forceRefresh?: boolean;
};

type AccountProfileRow = {
  id: string;
  displayName: string | null;
  displayImage: string | null;
  neupid: string | null;
};

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeProfileRow(row: AccountProfileRow): AccountProfile {
  return {
    id: row.id,
    displayName: row.displayName,
    displayImage: row.displayImage,
    neupid: row.neupid,
  };
}

export async function getStoredAccountProfile(accountId: string): Promise<AccountProfile | null> {
  const normalizedAccountId = accountId.trim();
  if (!normalizedAccountId) return null;

  const rows = await prisma.$queryRaw<AccountProfileRow[]>`
    SELECT id, "displayName", "displayImage", neupid
    FROM "accounts"
    WHERE id = ${normalizedAccountId}
    LIMIT 1
  `;

  return rows[0] ? normalizeProfileRow(rows[0]) : null;
}

export async function getAccountDisplayName(accountId: string): Promise<string | null> {
  const normalizedAccountId = accountId.trim();
  if (!normalizedAccountId) return null;

  const storedProfile = await getStoredAccountProfile(normalizedAccountId);
  if (storedProfile?.displayName) return storedProfile.displayName;

  try {
    const response = await logica.account.lookup.byId(normalizedAccountId).get(['displayName']);
    if (!response.ok || !response.body.success) return null;
    return normalizeString(response.body.displayName);
  } catch {
    return null;
  }
}

export async function getCurrentAccountId(): Promise<string | null> {
  try {
    const authAccountToken = await getCookie('auth_account');
    if (authAccountToken) {
      try {
        const accountId = await logica.account.current.id.get(authAccountToken);
        if (accountId?.trim()) return accountId.trim();
      } catch {
        // Fall through to local token and account-context cookie lookup.
      }
    }

    const authentication = await logica.account.self.isAuthenticated('local');
    if (authentication.authenticated && 'payload' in authentication) {
      const accountId = authentication.payload.aid;
      if (typeof accountId === 'string' && accountId.trim()) return accountId.trim();
    }

    for (const cookieName of ['accountId', 'account_id', 'neup_account_id', 'selected_account_id']) {
      const value = await getCookie(cookieName);
      if (value?.trim()) return value.trim();
    }

    return null;
  } catch {
    return null;
  }
}

export async function getCurrentAccountDisplayName(): Promise<string | null> {
  try {
    const displayName = await getCookie('neup_profile_display_name');
    return normalizeString(displayName);
  } catch {
    return null;
  }
}

async function fetchAccountProfileFromNeupAccount(
  accountId: string,
  fallbackNeupId?: string | null,
): Promise<Omit<AccountProfile, 'id'>> {
  const response = await logica.account.lookup.byId(accountId).get([
    'displayName',
    'displayImage',
    'neupid',
  ]);

  if (!response.ok || !response.body.success) {
    throw new Error(response.body.error ?? `Unable to fetch account profile (${response.status}).`);
  }

  return {
    displayName: normalizeString(response.body.displayName),
    displayImage: normalizeString(response.body.displayImage),
    neupid: normalizeString(response.body.neupid) ?? normalizeString(fallbackNeupId),
  };
}

async function upsertAccountProfile(profile: AccountProfile): Promise<AccountProfile> {
  const rows = await prisma.$queryRaw<AccountProfileRow[]>`
    INSERT INTO "accounts" (id, "displayName", "displayImage", neupid)
    VALUES (${profile.id}, ${profile.displayName}, ${profile.displayImage}, ${profile.neupid})
    ON CONFLICT (id) DO UPDATE SET
      "displayName" = COALESCE(EXCLUDED."displayName", "accounts"."displayName"),
      "displayImage" = COALESCE(EXCLUDED."displayImage", "accounts"."displayImage"),
      neupid = COALESCE(EXCLUDED.neupid, "accounts".neupid)
    RETURNING id, "displayName", "displayImage", neupid
  `;

  return normalizeProfileRow(rows[0]);
}

async function notifyNeupAccountCreated(profile: AccountProfile): Promise<void> {
  const notifyUrl = process.env.NEUP_ACCOUNT_CREATED_NOTIFY_URL?.trim();
  if (!notifyUrl) return;

  try {
    await fetch(notifyUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.NEUP_ACCOUNT_CREATED_NOTIFY_SECRET
          ? { authorization: `Bearer ${process.env.NEUP_ACCOUNT_CREATED_NOTIFY_SECRET}` }
          : {}),
      },
      body: JSON.stringify({
        accountId: profile.id,
        neupid: profile.neupid,
        displayName: profile.displayName,
        displayImage: profile.displayImage,
      }),
      cache: 'no-store',
    });
  } catch (error) {
    console.error('[account profile] failed to notify Neup Account:', error);
  }
}

export async function ensureAccountProfile(input: EnsureAccountProfileInput): Promise<AccountProfile> {
  const accountId = input.accountId.trim();
  if (!accountId) {
    throw new Error('accountId is required.');
  }

  const existing = await getStoredAccountProfile(accountId);
  if (existing?.displayName && existing.neupid && !input.forceRefresh) {
    return existing;
  }

  const remoteProfile = await fetchAccountProfileFromNeupAccount(accountId, input.neupid);
  const created = !existing;
  const profile = await upsertAccountProfile({
    id: accountId,
    ...remoteProfile,
  });

  if (created) {
    await notifyNeupAccountCreated(profile);
  }

  return profile;
}
