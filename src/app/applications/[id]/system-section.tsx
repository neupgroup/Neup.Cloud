
'use client';

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Calendar, Clock, FolderOpen, Network, User } from "lucide-react";
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SystemSectionProps {
    application: any;
}

export function SystemSection({ application }: SystemSectionProps) {
    const router = useRouter();

    const InfoRow = ({
        icon: Icon,
        title,
        description,
        href,
        isLast = false,
        onClick
    }: {
        icon: any,
        title: string,
        description: string | React.ReactNode,
        href?: string,
        isLast?: boolean,
        onClick?: () => void
    }) => {
        const Content = () => (
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between mb-0 h-8">
                    <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground">
                        {title}
                    </h3>
                    <div className="flex items-center gap-1">
                        <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                            <Icon className="h-4 w-4" />
                        </div>
                    </div>
                </div>
                <div className="text-sm text-muted-foreground line-clamp-2">
                    {description}
                </div>
            </div>
        );

        const className = cn(
            "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4",
            href || onClick ? "cursor-pointer" : "cursor-default",
            !isLast && "border-b border-border"
        );

        if (href) {
            return (
                <Link href={href} className={className}>
                    <Content />
                </Link>
            );
        }

        return (
            <div className={className} onClick={onClick}>
                <Content />
            </div>
        );
    };

    const uniquePorts = application.networkAccess?.map(String).filter((p: string) => p && p !== "NaN") || [];

    const portsDescription = uniquePorts.length > 0
        ? uniquePorts.join(', ')
        : "No ports exposed";

    const createdDate = application.createdAt ? new Date(application.createdAt).toLocaleString() : 'Unknown';
    const updatedDate = application.updatedAt ? new Date(application.updatedAt).toLocaleString() : 'Unknown';

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-500 delay-100">
            <h3 className="text-lg font-medium flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                System & Metadata
            </h3>

            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                {/* File Manager */}
                <InfoRow
                    icon={FolderOpen}
                    title="File Manager"
                    description={`Browse files at ${application.location}`}
                    href={`/files?path=${encodeURIComponent(application.location)}`}
                />

                {/* Network */}
                <InfoRow
                    icon={Network}
                    title="Network Access"
                    description={portsDescription}
                />

                {/* Owner */}
                <InfoRow
                    icon={User}
                    title="Owner"
                    description={application.owner || "System"}
                />

                {/* Timestamps */}
                <InfoRow
                    icon={Calendar}
                    title="Timestamps"
                    description={
                        <span className="flex flex-col sm:flex-row sm:gap-4">
                            <span>Created: {createdDate}</span>
                            <span className="hidden sm:inline text-muted-foreground/50">|</span>
                            <span>Updated: {updatedDate}</span>
                        </span>
                    }
                    isLast
                />
            </Card>
        </div>
    );
}
