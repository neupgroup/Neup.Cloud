import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageTitleBack } from "@/components/page-header";

export default function Loading() {
    return (
        <div className="grid gap-8 animate-in fade-in duration-500 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <PageTitleBack
                    backHref="#"
                    title={
                        <span className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-xl" />
                            <div className="flex flex-col gap-1">
                                <Skeleton className="h-6 w-32" />
                                <Skeleton className="h-3 w-48" />
                            </div>
                        </span>
                    }
                />
                <Skeleton className="h-9 w-32" />
            </div>

            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-9 w-64" />
                        <Skeleton className="h-9 w-9" />
                    </div>
                </div>
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-4 border-b last:border-0 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-48" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-8 w-16" />
                            <Skeleton className="h-8 w-8" />
                        </div>
                    </div>
                ))}
            </Card>
        </div>
    );
}
