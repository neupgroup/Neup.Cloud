'use client';

import Link from 'next/link';
import {
  Home,
  Menu,
  X,
  Server,
  Lightbulb,
  CreditCard,
  CircleUser,
  HeartPulse,
  HardDrive,
  FileCode,
  Terminal,
  FileText,
  ShieldAlert,
  Search,
  FolderKanban,
  Network,
  Settings,
  Globe,
  Plus,
  Layers,
  Database,
  ArrowUpCircle,
  Package,
  Users,
  Key,
  KeyRound,
  FileKey,
  LayoutGrid,
  ListChecks,
  Monitor,
  Shield,
  ScrollText,
  Activity,
  Rocket,
  Play,
  Bot,
  Workflow,
  Mail
} from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/core/utils';
import { Button } from '@/components/ui/button';
import { useState, useEffect, Suspense } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Logo } from '@/components/logo';
import { Toaster } from "@/components/ui/toaster"
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProgressBar } from '@/components/progress-bar';
import NProgress from 'nprogress';

import { findLongestMatch } from '@/services/core/findLongestMatch';
import {
  shouldPreserveSelectedServer,
  withSelectedServerQuery,
} from '@/inapp/helpers/navigation';
import { getSelectedServer } from '@/inapp/helpers/selection';

type CurrentAccountProfile = {
  displayName: string | null;
  displayImage: string | null;
  neupid: string | null;
};

function NavLink({
  href,
  children,
  currentPath,
  allPaths,
  selectedServerId,
  onClick
}: {
  href: string;
  children: React.ReactNode;
  currentPath: string;
  allPaths: string[];
  selectedServerId: string | null;
  onClick?: () => void;
}) {
  // Find the longest matching path from all available paths
  const longestMatch = findLongestMatch(currentPath, allPaths);
  const isActive = longestMatch === href;
  const nextHref = withSelectedServerQuery(href, selectedServerId);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (currentPath !== href) {
      NProgress.start();
    }
    if (onClick) {
      onClick();
    }
  };

  return (
    <Link
      href={nextHref}
      onClick={handleClick}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold hover:bg-muted hover:text-primary',
        isActive && 'bg-muted text-primary mr-4'
      )}
    >
      {children}
    </Link>
  );
}


function MainNavContent({ currentPath, onLinkClick, isServerSelected, selectedServerId }: { currentPath: string, onLinkClick?: () => void, isServerSelected: boolean, selectedServerId: string | null }) {
  const navLinks = [
    { href: "/home", label: "Dashboard", icon: Home },
  ];

  const intelligenceLinks = [
    { href: "/intelligence", label: "Home", icon: Lightbulb },
    { href: "/intelligence/access", label: "Access", icon: KeyRound },
    { href: "/intelligence/models", label: "Models", icon: Bot },
    { href: "/intelligence/tokens", label: "Tokens", icon: Key },
    { href: "/intelligence/logs", label: "Logs", icon: ScrollText },
    { href: "/intelligence/billing", label: "Billing", icon: CreditCard },
  ];

  const pipelineLinks = [
    { href: "/pipeline", label: "Home", icon: Workflow },
    { href: "/pipeline/editor", label: "Editor", icon: Play },
    { href: "/pipeline/instance", label: "Instances", icon: ListChecks },
  ];

  const domainLinks = [
    { href: "/domains", label: "Domains", icon: Globe },
    { href: "/domains/add", label: "Add Domain", icon: Plus },
  ];

  const securityLinks = [
    { href: "/security", label: "Home", icon: Shield },
    { href: "/security/ddos", label: "DDoS", icon: ShieldAlert },
  ];

  const accountLinks = [
    { href: "/server/list", label: "Servers", icon: Server },
    { href: "/environments", label: "Environments", icon: Layers },
    { href: "/database", label: "Databases", icon: Database },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/mail", label: "Mail", icon: Mail },
    { href: "/billing", label: "Billing", icon: CreditCard },
  ]

  const maintenanceLinks = [
    { href: "/logger", label: "Logger", icon: ScrollText },
  ];

  const serverLinks = [
    { href: "/server/home", label: "Home", icon: Home },
    { href: "/server/status", label: "Status", icon: HeartPulse },
    { href: "/server/processes", label: "Processes", icon: Network },
    { href: "/server/applications", label: "Applications", icon: Activity },
    { href: "/server/database", label: "Databases", icon: Database },
    { href: "/server/mail", label: "Mail", icon: Mail },
    { href: "/server/commands", label: "Commands", icon: Terminal },
    { href: "/server/firewall", label: "Firewall", icon: ShieldAlert },
    { href: "/server/files", label: "File Manager", icon: FolderKanban },
    { href: "/server/search", label: "Search Files", icon: Search },
    { href: "/server/webservices", label: "Webservices", icon: Globe },
    { href: "/server/system", label: "System", icon: LayoutGrid },
  ]

  /* Maintenance Links removed as they are moved to System */

  const rootLinks = [
    { href: "/root/servers", label: "Manage Servers", icon: Settings },
    { href: "/errors", label: "Errors", icon: ShieldAlert },
  ]

  // Collect all paths for longest match calculation
  const allPaths = [
    ...navLinks.map(l => l.href),
    ...intelligenceLinks.map(l => l.href),
    ...pipelineLinks.map(l => l.href),
    ...domainLinks.map(l => l.href),
    ...securityLinks.map(l => l.href),
    ...accountLinks.map(l => l.href),
    ...maintenanceLinks.map(l => l.href),
    ...(isServerSelected ? serverLinks.map(l => l.href) : []),
    // maintenanceLinks removed

    ...rootLinks.map(l => l.href),
  ];

  return (
    <nav className="flex flex-col gap-4">
      <div className="space-y-2">
        {navLinks.map(({ href, label, icon: Icon }) => (
          <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} selectedServerId={selectedServerId} onClick={onLinkClick}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      {isServerSelected && (
        <div className="space-y-2">
          <div className="px-3 text-xs font-semibold uppercase text-muted-foreground pt-4">
            Server
          </div>
          {serverLinks.map(({ href, label, icon: Icon }) => (
            <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} selectedServerId={selectedServerId} onClick={onLinkClick}>
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="px-3 text-xs font-semibold uppercase text-muted-foreground pt-4">
          Intelligence
        </div>
        {intelligenceLinks.map(({ href, label, icon: Icon }) => (
          <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} selectedServerId={selectedServerId} onClick={onLinkClick}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      <div className="space-y-2">
        <div className="px-3 text-xs font-semibold uppercase text-muted-foreground pt-4">
          Pipeline
        </div>
        {pipelineLinks.map(({ href, label, icon: Icon }) => (
          <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} selectedServerId={selectedServerId} onClick={onLinkClick}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      <div className="space-y-2">
        <div className="px-3 text-xs font-semibold uppercase text-muted-foreground pt-4">
          Domains
        </div>
        {domainLinks.map(({ href, label, icon: Icon }) => (
          <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} selectedServerId={selectedServerId} onClick={onLinkClick}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      <div className="space-y-2">
        <div className="px-3 text-xs font-semibold uppercase text-muted-foreground pt-4">
          Maintenance
        </div>
        {maintenanceLinks.map(({ href, label, icon: Icon }) => (
          <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} selectedServerId={selectedServerId} onClick={onLinkClick}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      <div className="space-y-2">
        <div className="px-3 text-xs font-semibold uppercase text-muted-foreground pt-4">
          Security
        </div>
        {securityLinks.map(({ href, label, icon: Icon }) => (
          <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} selectedServerId={selectedServerId} onClick={onLinkClick}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      <div className="space-y-2">
        <div className="px-3 text-xs font-semibold uppercase text-muted-foreground pt-4">
          Account
        </div>
        {accountLinks.map(({ href, label, icon: Icon }) => (
          <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} selectedServerId={selectedServerId} onClick={onLinkClick}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

    </nav>
  );
}

function Header({
  isMobileMenuOpen,
  toggleMobileMenu,
  accountProfile,
}: {
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  accountProfile: CurrentAccountProfile;
}) {
  const displayName = accountProfile.displayName ?? 'My Account';
  const neupId = accountProfile.neupid;

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center border-b bg-background shadow-[0_16px_40px_rgba(15,23,42,0.10)]">
      <div className="mx-auto flex w-full max-w-[1440px] items-center px-4 sm:px-6 md:px-8">
        <div className="flex items-center gap-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={toggleMobileMenu}>
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
        <div className="hidden lg:flex">
          <Logo />
        </div>
        <div className="flex w-full items-center lg:hidden">
          <div className="mx-auto">
            <Logo />
          </div>
        </div>
        <div className="ml-auto">
          <Link href="/profile" className="flex h-11 max-w-[280px] items-center gap-3 rounded-md px-2.5 hover:bg-muted">
            <span className="hidden min-w-0 text-right sm:block">
              <span className="block truncate text-sm font-semibold leading-tight text-foreground">{displayName}</span>
              {neupId && (
                <span className="block truncate text-xs font-medium leading-tight text-muted-foreground">{neupId}</span>
              )}
            </span>
            <Avatar className="h-8 w-8">
              <AvatarImage src={accountProfile.displayImage ?? undefined} alt={displayName} />
              <AvatarFallback>
                <CircleUser className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
  initialProfile,
}: {
  children: React.ReactNode;
  initialProfile: CurrentAccountProfile;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isServerSelected, setIsServerSelected] = useState(false);
  const isPlainRoute = pathname === '/pipeline/editor' || pathname.startsWith('/pipeline/editor/');

  useEffect(() => {
    if (!shouldPreserveSelectedServer(pathname)) {
      setSelectedServerId(null);
      setIsServerSelected(false);
      return;
    }

    const nextSelectedServerId = getSelectedServer(searchParams);
    setSelectedServerId(nextSelectedServerId);
    setIsServerSelected(Boolean(nextSelectedServerId));
  }, [pathname, searchParams]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (isPlainRoute) {
      setIsMobileMenuOpen(false);
    }
  }, [isPlainRoute]);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Neup.Cloud | Modern Infrastructure Control</title>
        <meta name="description" content="The future of cloud infrastructure." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-white">
        {isPlainRoute ? (
          <div className="min-h-screen w-full bg-white text-foreground">{children}</div>
        ) : (
          <div className="min-h-screen w-full bg-white text-foreground">
            <Header
              isMobileMenuOpen={isMobileMenuOpen}
              toggleMobileMenu={toggleMobileMenu}
              accountProfile={initialProfile}
            />

            <div className={cn(
              "fixed top-16 left-0 right-0 bottom-0 z-30 bg-background/95 backdrop-blur-sm transition-all duration-300 ease-in-out lg:hidden",
              isMobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
            )}>
              <ScrollArea className="h-full">
                <div className="p-4 sm:p-6">
                  <MainNavContent currentPath={pathname} onLinkClick={closeMobileMenu} isServerSelected={isServerSelected} selectedServerId={selectedServerId} />
                </div>
              </ScrollArea>
            </div>

            <div className="mx-auto grid w-full max-w-[1440px] lg:grid-cols-[260px_1fr]">
              <aside className="hidden h-[calc(100vh-4rem)] flex-col border-r bg-background lg:sticky lg:top-16 lg:flex">
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    <MainNavContent currentPath={pathname} isServerSelected={isServerSelected} selectedServerId={selectedServerId} />
                  </div>
                </ScrollArea>
              </aside>

              <main className="min-h-[calc(100vh-4rem)] p-6 md:p-10">
                <div className="w-full">{children}</div>
              </main>
            </div>
          </div>
        )}
        <Toaster />
        <Suspense fallback={null}>
          <ProgressBar />
        </Suspense>
      </body>
    </html>
  );
}
