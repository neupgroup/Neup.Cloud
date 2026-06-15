'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/core/utils';
import { useSelectedServerId } from '@/core/hooks/use-selected-server';
import { withSelectedServerQuery } from '@/core/server-context';

export function ServerNameLink({ name, className }: { name: string; className?: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const selectedServerId = useSelectedServerId();

    return (
        <span
            className={cn(
                "font-medium text-foreground cursor-pointer hover:underline hover:text-primary transition-colors",
                className
            )}
            onClick={() => {
                const query = searchParams?.toString();
                const currentPath = withSelectedServerQuery(query ? `${pathname}?${query}` : pathname, selectedServerId);
                router.push(`/server/list?redirects=${encodeURIComponent(currentPath)}`);
            }}
        >
            {name}
        </span>
    );
}
