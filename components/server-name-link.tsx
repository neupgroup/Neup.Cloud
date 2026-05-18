'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/core/utils';

export function ServerNameLink({ name, className }: { name: string; className?: string }) {
    const router = useRouter();

    return (
        <span
            className={cn(
                "font-medium text-foreground cursor-pointer hover:underline hover:text-primary transition-colors",
                className
            )}
            onClick={() => {
                const currentPath = window.location.pathname;
                router.push(`/server/list?redirects=${currentPath}`);
            }}
        >
            {name}
        </span>
    );
}
