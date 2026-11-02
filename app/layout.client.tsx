'use client';

/**
 * Client-only half of the root layout.
 *
 * This file owns interactive navigation, route hooks, React state, and the
 * periodic profile refresh. It stays separate from layout.server.tsx because
 * client hooks and browser APIs require the `use client` boundary, while that
 * server file reads cookies and performs request-time data loading. Combining
 * both responsibilities in a client module would prevent those server APIs
 * from being used safely.
 */
import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  Bell,
  CreditCard,
  Database,
  FolderKanban,
  Globe,
  HeartPulse,
  Home,
  LayoutGrid,
  Layers,
  ListChecks,
  Mail,
  Network,
  Play,
  Plus,
  ScrollText,
  Search,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  Terminal,
  Workflow,
} from 'lucide-react';
import HeaderSidebarLayout, { type SidebarLink, type SidebarLinkGroup } from '@neup/components/layout/header-sidebar-layout';
import { Logo } from '@/components/logo';
import { ProgressBar } from '@/components/progress-bar';
import { shouldPreserveSelectedServer, withSelectedServerQuery } from '@/helpers/navigation';
import { getSelectedServer, selectServer } from '@/helpers/selection';

type CurrentAccountProfile = {
  displayName: string | null;
  displayImage: string | null;
  neupid: string | null;
};

type RootLayoutClientProps = {
  children: React.ReactNode;
  initialProfile: CurrentAccountProfile;
  initialSelectedServerId: string | null;
};

// Keep route groups and labels from the current application navigation.
function createSidebarGroups(isServerSelected: boolean): SidebarLinkGroup[] {
  const group = (label: string | undefined, links: SidebarLink[]): SidebarLinkGroup => ({ label, links });
  const link = (href: string, label: string, icon: SidebarLink['icon'], external = false): SidebarLink => ({ href, label, icon, external });
  return [
    group(undefined, [link('/home', 'Dashboard', Home), link('/notifications', 'Notifications', Bell)]),
    ...(isServerSelected ? [group('Server', [
      link('/server/home', 'Home', Home), link('/server/status', 'Status', HeartPulse),
      link('/server/processes', 'Processes', Network), link('/server/applications', 'Applications', Activity),
      link('/server/database', 'Databases', Database), link('/server/mail', 'Mail', Mail),
      link('/server/commands', 'Commands', Terminal), link('/server/firewall', 'Firewall', ShieldAlert),
      link('/server/files', 'File Manager', FolderKanban), link('/server/search', 'Search Files', Search),
      link('/server/webservices', 'Webservices', Globe), link('/server/system', 'System', LayoutGrid),
    ])] : []),
    group('Pipeline', [link('/pipeline', 'Home', Workflow), link('/pipeline/editor', 'Editor', Play), link('/pipeline/instance', 'Instances', ListChecks)]),
    group('Domains', [link('/domains', 'Domains', Globe), link('/domains/add', 'Add Domain', Plus)]),
    group('Maintenance', [link('/logger', 'Logger', ScrollText)]),
    group('Security', [link('/security', 'Home', Shield), link('/security/ddos', 'DDoS', ShieldAlert)]),
    group('Account', [
      link('/server/list', 'Servers', Server), link('/environments', 'Environments', Layers),
      link('/database', 'Databases', Database), link('/settings', 'Settings', Settings),
      link('/mail', 'Mail', Mail), link('https://neupgroup.com/account/billing', 'Billing', CreditCard, true),
    ]),
  ];
}

// Refresh profile details periodically while retaining the last known profile on failure.
function useAccountProfile(initialProfile: CurrentAccountProfile) {
  const [accountProfile, setAccountProfile] = useState(initialProfile);

  useEffect(() => {
    const refreshAccountProfile = async () => {
      try {
        const response = await fetch('/cloud/api/account/profile', {
          method: 'GET', credentials: 'include', cache: 'no-store',
        });
        if (!response.ok) return;
        setAccountProfile(await response.json() as CurrentAccountProfile);
      } catch {
        // Keep the last known profile when a background refresh fails.
      }
    };
    const interval = window.setInterval(refreshAccountProfile, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  return accountProfile;
}

// Preserve server selection in both navigation links and server-specific routes.
function useSelectedServer(initialSelectedServerId: string | null) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSelectedServerId = getSelectedServer(searchParams);

  useEffect(() => {
    if (!shouldPreserveSelectedServer(pathname) || currentSelectedServerId || !initialSelectedServerId) return;
    const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    router.replace(selectServer(currentUrl, initialSelectedServerId), { scroll: false });
  }, [currentSelectedServerId, initialSelectedServerId, pathname, router, searchParams]);

  return useMemo(() => {
    const isSelected = shouldPreserveSelectedServer(pathname)
      && Boolean(currentSelectedServerId ?? initialSelectedServerId);
    return {
      isSelected,
      groups: createSidebarGroups(isSelected).map(group => ({
        ...group,
        links: group.links.map(item => ({
          ...item,
          href: item.external ? item.href : withSelectedServerQuery(item.href, currentSelectedServerId ?? initialSelectedServerId),
        })),
      })),
    };
  }, [currentSelectedServerId, initialSelectedServerId, pathname]);
}

// Use the shared header and sidebar layout while retaining route-specific app behavior.
export default function RootLayoutClient({ children, initialProfile, initialSelectedServerId }: RootLayoutClientProps) {
  const pathname = usePathname();
  const accountProfile = useAccountProfile(initialProfile);
  const { groups, isSelected } = useSelectedServer(initialSelectedServerId);
  const isPlainRoute = pathname === '/pipeline/editor' || pathname.startsWith('/pipeline/editor/');

  if (isPlainRoute) {
    return <div className="min-h-screen w-full bg-white text-foreground">{children}</div>;
  }

  return (
    <>
      <HeaderSidebarLayout
        sidebarlinks={groups}
        pofileBarInfo={{
          href: '/profile',
          displayName: accountProfile.displayName,
          displayImage: accountProfile.displayImage,
          neupid: accountProfile.neupid,
        }}
        headerLinks={[<Logo key="application-logo" />]}
      >
        {children}
      </HeaderSidebarLayout>
      <Suspense fallback={null}><ProgressBar /></Suspense>
    </>
  );
}
