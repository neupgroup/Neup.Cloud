import { cookies } from 'next/headers';
import RootLayoutClient from '@/components/root-layout-client';
import { ensureAccountProfile, getCurrentAccountId, getStoredSelectedServer } from '@/services/account-profile';
import BaseLayout from '@neup/components/layout/RootLayout';
import { getApplicationBranding } from '@/services/core/application-brand';
import './globals.css';

type CurrentAccountProfile = {
  displayName: string | null;
  displayImage: string | null;
  neupid: string | null;
};

function formatNeupId(value: string | null) {
  if (!value) return null;
  return value.startsWith('@') ? value : `@${value}`;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = getApplicationBranding();
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

  if (!initialProfile.displayName || !initialProfile.displayImage || !initialProfile.neupid) {
    if (accountId) {
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
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Neup.Cloud | Modern Infrastructure Control</title>
        <meta name="description" content="The future of cloud infrastructure." />
        <link rel="icon" href={branding.favicon} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-white">
        <BaseLayout>
          <RootLayoutClient initialProfile={initialProfile} initialSelectedServerId={initialSelectedServerId}>
            {children}
          </RootLayoutClient>
        </BaseLayout>
      </body>
    </html>
  );
}
