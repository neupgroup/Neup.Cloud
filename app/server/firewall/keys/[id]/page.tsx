import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, ChevronLeft } from "lucide-react";
import Link from 'next/link';
import { getAuthorizedKeys } from "../actions";
import { cookies } from 'next/headers';
import { notFound } from "next/navigation";

export default async function ViewKeyPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const keyIndex = parseInt(id, 10);

    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;

    if (!serverId) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                <p className="text-muted-foreground">No server selected.</p>
                <Button asChild variant="outline">
                    <Link href="/servers">Select a Server</Link>
                </Button>
            </div>
        );
    }

    const { keys, error } = await getAuthorizedKeys(serverId);

    if (error || !keys) {
        return (
            <div className="p-8 text-center text-destructive space-y-2">
                <h3 className="font-semibold">Error Loading Keys</h3>
                <p className="text-sm">{error || "Unknown error occurred."}</p>
                <Button asChild variant="outline" className="mt-4">
                    <Link href="/server/firewall/keys">Back to Keys</Link>
                </Button>
            </div>
        );
    }

    const key = keys.find(k => k.index === keyIndex);

    if (!key) {
        return notFound();
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Responsive Header */}
            <div className="flex flex-col gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-fit -ml-2 text-muted-foreground hover:text-foreground"
                    asChild
                >
                    <Link href="/server/firewall/keys">
                        <ChevronLeft className="mr-1 h-4 w-4" /> Back to Firewall Keys
                    </Link>
                </Button>

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-all">
                            {key.comment !== 'No comment' ? key.comment : `Key #${key.index + 1}`}
                        </h1>
                        <p className="text-muted-foreground">View details of this authorized key.</p>
                    </div>
                    <Button variant="destructive" size="sm" className="w-full sm:w-auto shrink-0">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Key
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle>Key Information</CardTitle>
                        <CardDescription>Metadata about this key.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <dl className="grid gap-4 text-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                                <dt className="font-medium text-muted-foreground">Type</dt>
                                <dd className="font-mono text-foreground sm:col-span-2 break-all">{key.type}</dd>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                                <dt className="font-medium text-muted-foreground">Index</dt>
                                <dd className="font-mono text-foreground sm:col-span-2">{key.index}</dd>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                                <dt className="font-medium text-muted-foreground">Source</dt>
                                <dd className="font-mono text-foreground sm:col-span-2 break-all">{key.source}</dd>
                            </div>
                        </dl>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Public Key Content</CardTitle>
                        <CardDescription>The actual public key string.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <Label htmlFor="raw-key" className="sr-only">Raw Key</Label>
                            <Textarea
                                id="raw-key"
                                readOnly
                                value={key.raw}
                                className="font-mono text-xs min-h-[150px] bg-muted/50 resize-y"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
