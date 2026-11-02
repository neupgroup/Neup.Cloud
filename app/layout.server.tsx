import { cookies } from 'next/headers';
import LayoutClient from './layout.client';
import { ensureAccountProfile, getCurrentAccountId, getStoredSelectedServer } from '@/services/account-profile';

/**
 * Server-only half of the root layout.
 *
 * This file reads request cookies and loads the initial profile and server
 * selection before passing serializable values to layout.client.tsx. It stays
 * separate because these server APIs cannot run inside a `use client` module;
 * marking this module as a client component would move it to the browser and
 * make cookie access and server-side data loading unavailable.
 */
export type CurrentAccountProfile = {
  displayName: string | null;
  displayImage: string | null;
  neupid: string | null;
};

// Normalize profile identifiers before passing them to the client layout.
function formatNeupId(value: string | null) {
  if (!value) return null;
  return value.startsWith('@') ? value : `@${value}`;
}

// Load request-specific profile and server selection data on the server.
export default async function LayoutServer({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const accountId = await getCurrentAccountId();
  let initialSelectedServerId: string | null = null;

  if (accountId) {
    try {
      initialSelectedServerId = await getStoredSelectedServer(accountId);
    } catch (error) {
      console.error('[root layout] failed to load selected server:', error);
    }
  }

  let initialProfile: CurrentAccountProfile = {
    displayName: cookieStore.get('neup_profile_display_name')?.value ?? null,
    displayImage: cookieStore.get('neup_profile_display_image')?.value ?? null,
    neupid: formatNeupId(cookieStore.get('neup_profile_neupid')?.value ?? null),
  };

  if ((!initialProfile.displayName || !initialProfile.displayImage || !initialProfile.neupid) && accountId) {
    try {
      const profile = await ensureAccountProfile({ accountId, forceRefresh: true });
      initialProfile = {
        displayName: profile.displayName,
        displayImage: profile.displayImage,
        neupid: formatNeupId(profile.neupid),
      };
    } catch (error) {
      console.error('[root layout] failed to load account profile:', error);
    }
  }

  return (
    <LayoutClient initialProfile={initialProfile} initialSelectedServerId={initialSelectedServerId}>
      {children}
    </LayoutClient>
  );
}
