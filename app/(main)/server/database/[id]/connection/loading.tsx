'use client';

import { Skeleton } from "#/components/ui/skeleton";
import { Card, CardContent } from "#/components/ui/card";
import { PageTitleBack } from "@/components/page-header";
import { usePathname } from 'next/navigation';
import { useSelectedServerId } from '@/hooks/use-selected-server';
import { withSelectedServerQuery } from '@/helpers/navigation';

export default function Loading() {
    const pathname = usePathname();
    const selectedServerId = useSelectedServerId();
    const backHref = withSelectedServerQuery(pathname.replace(/\/connection$/, ''), selectedServerId);

    return (
        <div className="grid gap-8 animate-in fade-in duration-500 pb-10">
            <PageTitleBack
                backHref={backHref}
                title={
                    <span className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-xl" />
                        <div className="flex flex-col gap-1">
                            <Skeleton className="h-6 w-40" />
                            <Skeleton className="h-3 w-56" />
                        </div>
                    </span>
                }
            />

            <div className="grid gap-6 max-w-2xl">
                <Card>
                    <CardContent className="p-6 space-y-6">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
