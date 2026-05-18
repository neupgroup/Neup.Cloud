'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/core/utils';

export function ServerNameLink({ name, className }: { name: string; className?: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    return (
        <span
            className={cn(
                "font-medium text-foreground cursor-pointer hover:underline hover:text-primary transition-colors",
                className
            )}
            onClick={() => {
                const query = searchParams?.toString();
                const currentPath = query ? `${pathname}?${query}` : pathname;
                router.push(`/server/list?redirects=${encodeURIComponent(currentPath)}`);
            }}
        >
            {name}
        </span>
    );
}
