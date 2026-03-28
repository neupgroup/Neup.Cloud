'use client';

import Link from 'next/link';
import {
  Home,
  Menu,
  X,
  Server,
  AppWindow,
  Lightbulb,
  CreditCard,
  CircleUser,
  HeartPulse,
  HardDrive,
  FileCode,
  Terminal,
  FileText,
  ShieldAlert,
  FolderKanban,
  History,
  Link2,
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
  Command,
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
  Workflow
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState, useEffect, Suspense } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Logo } from '@/components/logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import { ProgressBar } from '@/components/progress-bar';
import NProgress from 'nprogress';
import Cookies from 'universal-cookie';
import { getServer } from '@/app/servers/actions';

// Helper function to find the longest matching path
function findLongestMatch(currentPath: string, allPaths: string[]): string | null {
  // Filter paths that the current path starts with
  const matchingPaths = allPaths.filter(path => {
    if (path === '/') {
      return currentPath === '/';
    }
    return currentPath === path || currentPath.startsWith(path + '/');
  });

  if (matchingPaths.length === 0) return null;

  // Sort by length (longest first) and return the longest match
  matchingPaths.sort((a, b) => b.length - a.length);
  return matchingPaths[0];
}

function NavLink({
  href,
  children,
  currentPath,
  allPaths,
  onClick
}: {
  href: string;
  children: React.ReactNode;
  currentPath: string;
  allPaths: string[];
  onClick?: () => void;
}) {
  // Find the longest matching path from all available paths
  const longestMatch = findLongestMatch(currentPath, allPaths);
  const isActive = longestMatch === href;

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
      href={href}
      onClick={handleClick}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold hover:bg-muted hover:text-primary',
        isActive && 'bg-muted text-primary'
      )}
    >
      {children}
    </Link>
  );
}


function MainNavContent({ currentPath, onLinkClick, isServerSelected, serverData }: { currentPath: string, onLinkClick?: () => void, isServerSelected: boolean, serverData: any }) {
  const navLinks = [
    { href: "/", label: "Dashboard", icon: Home },
  ];

  const intelligenceLinks = [
    { href: "/intelligence", label: "Home", icon: Lightbulb },
    { href: "/intelligence/prompts", label: "Prompts", icon: KeyRound },
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

  const accountLinks = [
    { href: "/servers", label: "Servers", icon: Server },
    { href: "/environments", label: "Environments", icon: Layers },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/billing", label: "Billing", icon: CreditCard },
    { href: "/linked-accounts", label: "Linked Accounts", icon: Link2 },
  ]

  const serverLinks = [
    { href: "/status", label: "Status", icon: HeartPulse },
    // Removed duplicate Applications link as it now has its own section
    // { href: "/applications", label: "Applications", icon: AppWindow },
    { href: "/processes", label: "Processes", icon: FileCode },
    { href: "/network", label: "Network", icon: Network },
    { href: "/database", label: "Databases", icon: Database },
  ]

  const applicationsLinks = [
    { href: "/applications", label: "Home", icon: AppWindow },
    { href: "/applications/running", label: "Running", icon: Activity },
    { href: "/applications/deploy", label: "Deploy", icon: Rocket },
  ]

  const commandsLinks = [
    { href: "/commands", label: "Home", icon: Terminal },
    { href: "/commands/set", label: "Command Set", icon: Command },
    { href: "/commands/custom", label: "Run Custom", icon: Play },
    { href: "/commands/history", label: "History", icon: History },
    { href: "/commands/create", label: "Create", icon: Plus },
    { href: "/commands/live", label: "Live Session", icon: Activity },
  ]

  /* Maintenance Links removed as they are moved to System */

  const firewallLinks = [
    { href: "/firewall", label: "Home", icon: ShieldAlert },
    { href: "/firewall/network", label: "Network", icon: Network },
    { href: "/firewall/users", label: "Users", icon: Users },
    { href: "/firewall/keys", label: "Keys", icon: Key },
  ]

  const rootLinks = [
    { href: "/root/servers", label: "Manage Servers", icon: Settings },
    { href: "/errors", label: "Errors", icon: ShieldAlert },
  ]

  // Build webservices links dynamically
  const webservicesLinks = [];
  webservicesLinks.push({ href: "/webservices", label: "Home", icon: Globe });

  if (serverData?.proxyHandler && serverData.proxyHandler !== 'None') {
    const proxyPath = serverData.proxyHandler === 'Nginx' ? '/webservices/nginx' : '/webservices/proxy';
    webservicesLinks.push({ href: proxyPath, label: `Manage Proxy`, icon: Network });
  }

  if (serverData?.loadBalancer && serverData.loadBalancer !== 'None') {
    const balancerPath = '/webservices/balancer';
    webservicesLinks.push({ href: balancerPath, label: `Manage Balancer`, icon: Network });
  }

  webservicesLinks.push({ href: "/webservices/certificates", label: "Certificates", icon: FileKey });

  webservicesLinks.push({ href: "/webservices/configure", label: "Configure", icon: Settings });

  const systemLinks = [
    { href: "/system", label: "Home", icon: LayoutGrid },
    { href: "/files", label: "File Manager", icon: FolderKanban },
    { href: "/packages", label: "Packages", icon: Package },
    { href: "/updates", label: "Updates", icon: ArrowUpCircle },
    { href: "/storage", label: "Storage", icon: HardDrive },
    { href: "/system/startup", label: "Startup", icon: Play },
    { href: "/system/requirement", label: "Requirements", icon: ListChecks },
  ];

  // Collect all paths for longest match calculation
  const allPaths = [
    ...navLinks.map(l => l.href),
    ...intelligenceLinks.map(l => l.href),
    ...pipelineLinks.map(l => l.href),
    ...domainLinks.map(l => l.href),
    ...accountLinks.map(l => l.href),
    ...(isServerSelected ? serverLinks.map(l => l.href) : []),
    ...(isServerSelected ? applicationsLinks.map(l => l.href) : []),
    ...(isServerSelected ? commandsLinks.map(l => l.href) : []),
    // maintenanceLinks removed
    ...(isServerSelected ? firewallLinks.map(l => l.href) : []),
    ...(isServerSelected ? webservicesLinks.map(l => l.href) : []),

    ...systemLinks.map(l => l.href),
    ...rootLinks.map(l => l.href),
  ];

  return (
    <nav className="flex flex-col gap-4">
      <div className="space-y-2">
        {navLinks.map(({ href, label, icon: Icon }) => (
          <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} onClick={onLinkClick}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      <div className="space-y-2">
        <div className="px-3 text-xs font-semibold uppercase text-muted-foreground pt-4">
          Intelligence
        </div>
        {intelligenceLinks.map(({ href, label, icon: Icon }) => (
          <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} onClick={onLinkClick}>
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
          <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} onClick={onLinkClick}>
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
          <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} onClick={onLinkClick}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      {isServerSelected && (
        <div className="space-y-2">
          <div className="px-3 text-xs font-semibold uppercase text-muted-foreground pt-4">
            Applications
          </div>
          {applicationsLinks.map(({ href, label, icon: Icon }) => (
            <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} onClick={onLinkClick}>
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      )}

      {isServerSelected && (
        <div className="space-y-2">
          <div className="px-3 text-xs font-semibold uppercase text-muted-foreground pt-4">
            Server
          </div>
          {serverLinks.map(({ href, label, icon: Icon }) => (
            <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} onClick={onLinkClick}>
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      )}

      {isServerSelected && (
        <div className="space-y-2">
          <div className="px-3 text-xs font-semibold uppercase text-muted-foreground pt-4">
            Commands
          </div>
          {commandsLinks.map(({ href, label, icon: Icon }) => (
            <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} onClick={onLinkClick}>
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      )}

      {isServerSelected && (
        <div className="space-y-2">
          <div className="px-3 text-xs font-semibold uppercase text-muted-foreground pt-4">
            Firewall
          </div>
          {firewallLinks.map(({ href, label, icon: Icon }) => (
            <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} onClick={onLinkClick}>
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      )}

      {isServerSelected && (
        <div className="space-y-2">
          <div className="px-3 text-xs font-semibold uppercase text-muted-foreground pt-4">
            Webservices
          </div>
          {webservicesLinks.map(({ href, label, icon: Icon }) => (
            <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} onClick={onLinkClick}>
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="px-3 text-xs font-semibold uppercase text-muted-foreground pt-4">
          Account
        </div>
        {accountLinks.map(({ href, label, icon: Icon }) => (
          <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} onClick={onLinkClick}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      <div className="space-y-2">
        <div className="px-3 text-xs font-semibold uppercase text-muted-foreground pt-4">
          System
        </div>
        {systemLinks.map(({ href, label, icon: Icon }) => (
          <NavLink key={label} href={href} currentPath={currentPath} allPaths={allPaths} onClick={onLinkClick}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>


    </nav>
  );
}

function Header({ isMobileMenuOpen, toggleMobileMenu }: { isMobileMenuOpen: boolean, toggleMobileMenu: () => void }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center border-b bg-background shadow-sm">
      <div className="mx-auto flex w-full max-w-[1440px] items-center px-4 sm:px-6 md:px-8">
        <div className="flex items-center gap-4 md:hidden">
          <Button variant="ghost" size="icon" onClick={toggleMobileMenu}>
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
        <div className="hidden md:flex">
          <Logo />
        </div>
        <div className="flex w-full items-center md:hidden">
          <div className="mx-auto">
            <Logo />
          </div>
        </div>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <CircleUser className="h-5 w-5" />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-sm border-muted">
              <DropdownMenuLabel className="text-xs uppercase tracking-widest font-bold">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs font-semibold">Settings</DropdownMenuItem>
              <DropdownMenuItem className="text-xs font-semibold">Support</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs font-bold text-destructive">Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isServerSelected, setIsServerSelected] = useState(false);
  const [serverData, setServerData] = useState<any>(null);
  const isPlainRoute = pathname === '/pipeline/editor' || pathname.startsWith('/pipeline/editor/');

  useEffect(() => {
    const cookies = new Cookies(null, { path: '/' });
    const checkCookie = async () => {
      const serverCookie = cookies.get('selected_server');
      setIsServerSelected(!!serverCookie);

      if (serverCookie) {
        try {
          const data = await getServer(serverCookie);
          setServerData(data);
        } catch (error) {
          console.error('Failed to fetch server data:', error);
        }
      } else {
        setServerData(null);
      }
    };
    checkCookie();
  }, [pathname]);

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
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-[#fafafa]">
        {isPlainRoute ? (
          <div className="min-h-screen w-full bg-[#f3f5f7] text-foreground">{children}</div>
        ) : (
          <div className="min-h-screen w-full bg-[#fafafa] text-foreground">
            <Header isMobileMenuOpen={isMobileMenuOpen} toggleMobileMenu={toggleMobileMenu} />

            <div className={cn(
              "fixed top-16 left-0 right-0 bottom-0 z-30 bg-background/95 backdrop-blur-sm transition-all duration-300 ease-in-out md:hidden",
              isMobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
            )}>
              <ScrollArea className="h-full">
                <div className="p-4 sm:p-6">
                  <MainNavContent currentPath={pathname} onLinkClick={closeMobileMenu} isServerSelected={isServerSelected} serverData={serverData} />
                </div>
              </ScrollArea>
            </div>

            <div className="mx-auto grid w-full max-w-[1440px] lg:grid-cols-[260px_1fr]">
              <aside className="hidden h-[calc(100vh-4rem)] flex-col border-r bg-background lg:sticky lg:top-16 lg:flex">
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    <MainNavContent currentPath={pathname} isServerSelected={isServerSelected} serverData={serverData} />
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
