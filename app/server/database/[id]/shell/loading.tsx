import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { PageTitleBack } from "@/components/page-header";

export default function Loading() {
    return (
        <div className="grid gap-8 animate-in fade-in duration-500 pb-10">
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

            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm bg-black/5 dark:bg-black/40">
                <div className="p-4 border-b flex items-center justify-between">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-8 w-24" />
                </div>
                <div className="p-6 h-[400px] flex flex-col justify-between">
                    <div className="space-y-3">
                        <Skeleton className="h-4 w-3/4 bg-muted/20" />
                        <Skeleton className="h-4 w-1/2 bg-muted/20" />
                        <Skeleton className="h-4 w-2/3 bg-muted/20" />
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 w-24" />
                    </div>
                </div>
            </Card>
        </div>
    );
}
