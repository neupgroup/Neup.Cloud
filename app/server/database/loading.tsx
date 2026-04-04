import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageTitle } from "@/components/page-header";
import { Database } from "lucide-react";

export default function Loading() {
    return (
        <div className="grid gap-8 animate-in fade-in duration-500 pb-10">
            <PageTitle
                title="Databases"
                description="Manage database engines and instances"
            />

            {/* Stats Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="pb-2">
                            <Skeleton className="h-3 w-24" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-16" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Databases List Skeleton */}
            <div className="grid gap-6">
                <div>
                    <Skeleton className="h-8 w-32 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </div>

                <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                    {/* Create Item Skeleton */}
                    <div className="p-4 border-b border-dashed border-border">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-10 w-10 rounded-lg" />
                            <div className="space-y-2 flex-1">
                                <div className="flex gap-2">
                                    <Skeleton className="h-5 w-40" />
                                    <Skeleton className="h-5 w-12" />
                                </div>
                                <Skeleton className="h-3 w-64" />
                            </div>
                        </div>
                    </div>

                    {/* List Items Skeleton */}
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="p-4 border-b border-border last:border-0">
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-9 w-9 rounded-lg" />
                                <div className="space-y-2 flex-1">
                                    <div className="flex gap-2">
                                        <Skeleton className="h-5 w-32" />
                                        <Skeleton className="h-5 w-16" />
                                    </div>
                                    <div className="flex gap-4">
                                        <Skeleton className="h-3 w-24" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                </div>
                                <Skeleton className="h-5 w-5 rounded-full" />
                            </div>
                        </div>
                    ))}
                </Card>
            </div>
        </div>
    );
}
