
'use client';

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FileText, Loader2, RefreshCw, Terminal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getApplicationLogs } from "@/app/server/applications/log-actions";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LogsSectionProps {
    application: any;
}

export function LogsSection({ application }: LogsSectionProps) {
    const [logs, setLogs] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const result = await getApplicationLogs(application.id, 100);
            if (result.error) {
                setLogs(`Error fetching logs: ${result.error}`);
            } else {
                setLogs(result.logs || "No logs available.");
            }
            setIsOpen(true);
        } catch (error) {
            setLogs("Failed to connect to server.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-500 delay-300">
            <h3 className="text-lg font-medium flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Logs
            </h3>

            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                    <div className="flex flex-col">
                        <h3 className="font-semibold text-foreground">Application Logs</h3>
                        <p className="text-sm text-muted-foreground">View the latest output from your application (stdout/stderr)</p>
                    </div>
                    <Button
                        variant="secondary"
                        onClick={fetchLogs}
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        {isOpen ? "Refresh Logs" : "View Logs"}
                    </Button>
                </div>

                {isOpen && (
                    <div className="border-t bg-muted/30 p-0 animate-in slide-in-from-top-2">
                        <div className="bg-zinc-950 text-zinc-50 font-mono text-xs p-4 overflow-x-auto whitespace-pre-wrap max-h-[500px] overflow-y-auto rounded-b-lg">
                            {logs || "Loading..."}
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
