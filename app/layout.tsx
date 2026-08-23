import { cookies } from 'next/headers';
import RootLayoutClient from '@/components/root-layout-client';
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
  const cookieStore = await cookies();
  const initialProfile: CurrentAccountProfile = {
    displayName: cookieStore.get('neup_profile_display_name')?.value ?? null,
    displayImage: cookieStore.get('neup_profile_display_image')?.value ?? null,
    neupid: formatNeupId(cookieStore.get('neup_profile_neupid')?.value ?? null),
  };

  return <RootLayoutClient initialProfile={initialProfile}>{children}</RootLayoutClient>;
}
