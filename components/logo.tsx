'use client';

import Image from 'next/image';
import { cn } from "@/core/utils";
import Link from "next/link";
import NProgress from 'nprogress';
import { usePathname } from 'next/navigation';
import application from '@/base/application.json';

export function Logo({ className }: { className?: string }) {
  const pathname = usePathname();
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== '/home') {
      NProgress.start();
    }
  };

  return (
    <Link href="/home" onClick={handleClick} className={cn("flex items-center gap-2 text-foreground", className)}>
      <Image
        src={application.appLogo.favicon}
        alt={`${application.appName} logo`}
        width={32}
        height={25}
        priority
        className="h-7 w-8 object-contain"
      />
      <span className="font-headline text-lg font-bold">{application.appName}</span>
    </Link>
  );
}
