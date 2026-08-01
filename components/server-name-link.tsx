'use client';

import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/core/utils';
import { getSelectedServerId, withSelectedServerQuery } from '@/inapp/helpers/navigation';

export function ServerNameLink({ name, className }: { name: string; className?: string }) {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <span
            className={cn(
                "font-medium text-foreground cursor-pointer hover:underline hover:text-primary transition-colors",
                className
            )}
            onClick={() => {
                const query = typeof window === 'undefined' ? '' : window.location.search;
                const selectedServerId = getSelectedServerId(query);
                const currentPath = withSelectedServerQuery(query ? `${pathname}${query}` : pathname, selectedServerId);
                router.push(`/server/list?redirects=${encodeURIComponent(currentPath)}`);
            }}
        >
            {name}
        </span>
    );
}
