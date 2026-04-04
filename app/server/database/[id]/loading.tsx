import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageTitleBack } from "@/components/page-header";
import { ChevronRight } from "lucide-react";

export default function Loading() {
    return (
        <div className="grid gap-8 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <PageTitleBack
                    backHref="/server/database"
                    title={
                        <span className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-xl" />
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-6 w-32" />
                                    <Skeleton className="h-4 w-16" />
                                </div>
                                <Skeleton className="h-3 w-24" />
                            </div>
                        </span>
                    }
                />
                <Skeleton className="h-9 w-24" />
            </div>

            {/* Stats Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-4 w-4 rounded-full" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-16 mb-1" />
                            <Skeleton className="h-3 w-24" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Management Section Skeleton */}
            <div className="space-y-6">
                <Skeleton className="h-7 w-32" />

                <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                    {[...Array(6)].map((_, i) => (
                        <div
                            key={i}
                            className="p-4 min-w-0 w-full border-b border-border last:border-0"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    <Skeleton className="h-9 w-9 rounded-lg" />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-5 w-32" />
                                            <Skeleton className="h-4 w-16" />
                                        </div>
                                        <Skeleton className="h-3 w-64" />
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground/20 shrink-0" />
                            </div>
                        </div>
                    ))}
                </Card>

                {/* Maintenance Notice Skeleton */}
                <div className="p-4 bg-muted/10 border border-border rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-3 w-full max-w-md" />
                </div>
            </div>
        </div>
    );
}
