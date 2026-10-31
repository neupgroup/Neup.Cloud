'use client';

import Image from 'next/image';
import { cn } from "@neup/core/utils";
import Link from "next/link";
import NProgress from 'nprogress';
import { usePathname } from 'next/navigation';
import { getApplicationBranding } from '@/services/core/application-brand';

export function Logo({ className }: { className?: string }) {
  const branding = getApplicationBranding();
  const pathname = usePathname();
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== '/home') {
      NProgress.start();
    }
  };

  return (
    <Link href="/home" onClick={handleClick} className={cn("flex items-center gap-2 text-foreground", className)}>
      <Image
        src={branding.mainLogo}
        alt={`${branding.appName} logo`}
        width={32}
        height={25}
        priority
        className="h-7 w-8 object-contain"
      />
      <span className="font-headline text-lg font-bold">{branding.appName}</span>
    </Link>
  );
}
