'use client';

import { PageTitleBack } from "@/components/page-header";
import { Card, CardHeader, CardContent } from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import { useSelectedServerId } from '@/hooks/use-selected-server';
import { withSelectedServerQuery } from '@/helpers/navigation';

export default function Loading() {
    const selectedServerId = useSelectedServerId();

    return (
        <div className="space-y-6">
            <PageTitleBack
                title="Create User"
                description="Add a new user account to this instance."
                backHref={withSelectedServerQuery('/server/firewall/users', selectedServerId)}
            />

            <div className="max-w-2xl">
                <Card>
                    <CardHeader className="space-y-2">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-64" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-3 w-48" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-3 w-48" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-3 w-48" />
                        </div>
                        <Skeleton className="h-10 w-32" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
