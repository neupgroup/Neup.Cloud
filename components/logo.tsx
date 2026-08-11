'use client';

import { Cloud } from "lucide-react";
import { cn } from "@/core/utils";
import Link from "next/link";
import NProgress from 'nprogress';
import { usePathname } from 'next/navigation';

export function Logo({ className }: { className?: string }) {
  const pathname = usePathname();
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== '/home') {
      NProgress.start();
    }
  };

  return (
    <Link href="/home" onClick={handleClick} className={cn("flex items-center gap-2 text-foreground", className)}>
      <Cloud className="h-6 w-6 text-primary" />
      <span className="font-headline text-lg font-bold">Neup.Cloud</span>
    </Link>
  );
}
