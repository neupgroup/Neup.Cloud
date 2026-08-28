import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Loader2 } from "lucide-react";
import { cn } from "@/core/utils";

interface SystemHealthCardProps {
    uptime: string | null;
    className?: string;
    onReboot?: () => void;
    isRebooting?: boolean;
}

export function SystemHealthCard({ uptime, className, onReboot, isRebooting }: SystemHealthCardProps) {
    const isActive = uptime && !['Loading...', 'Unavailable', 'N/A', 'Error', 'Checking...'].includes(uptime);
    const displayStatus = isActive ? 'Active' : (uptime || 'Checking...');
    const displayMessage = isActive ? `Up ${uptime}` : 'Waiting for status';

    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Health</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">
                    {displayStatus}
                </div>
                <p className="text-xs text-muted-foreground">
                    {displayMessage}
                </p>

                {onReboot && (
                    <button
                        className="text-xs text-destructive hover:underline mt-2 disabled:opacity-50 flex items-center gap-1"
                        onClick={onReboot}
                        disabled={isRebooting}
                    >
                        {isRebooting && <Loader2 className="h-3 w-3 animate-spin" />}
                        {isRebooting ? "Rebooting..." : "Reboot Server"}
                    </button>
                )}
            </CardContent>
        </Card>
    )
}
