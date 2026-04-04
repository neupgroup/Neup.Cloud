import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
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
                            <Skeleton className="h-6 w-40" />
                            <Skeleton className="h-3 w-56" />
                        </div>
                    </span>
                }
            />

            <div className="grid gap-6">
                <Card>
                    <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                        <Skeleton className="h-16 w-16 rounded-full" />
                        <div className="space-y-2 w-full flex flex-col items-center">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-64" />
                        </div>
                        <Skeleton className="h-10 w-40 mt-4" />
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <Skeleton className="h-5 w-32" />
                    <Card>
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="p-4 border-b last:border-0 flex items-center justify-between">
                                <div className="space-y-2">
                                    <Skeleton className="h-5 w-40" />
                                    <Skeleton className="h-3 w-24" />
                                </div>
                                <Skeleton className="h-9 w-24" />
                            </div>
                        ))}
                    </Card>
                </div>
            </div>
        </div>
    );
}
