'use client';

import Link from 'next/link';
import { FolderOpen, Network, ScrollText, AlertCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useSelectedServerHref } from '@/core/hooks/use-selected-server';
import { cn } from "@/core/utils";
import { useSystemSection, SystemSectionProps } from '@/components/applications/system-section';

export function SystemSection({ application }: SystemSectionProps) {
  const { portsDescription, outputLogPath, errorLogPath } = useSystemSection(application);
  const withSelectedServer = useSelectedServerHref();

  const InfoRow = ({
    icon: Icon,
    title,
    description,
    href,
    openInNewTab = false,
    isLast = false,
    onClick,
  }: {
    icon: any;
    title: string;
    description: string | React.ReactNode;
    href?: string;
    openInNewTab?: boolean;
    isLast?: boolean;
    onClick?: () => void;
  }) => {
    const content = (
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
      (href || onClick) ? "cursor-pointer" : "cursor-default",
      !isLast && "border-b border-border"
    );

    if (href) {
      return (
        <Link
          href={href}
          className={className}
          target={openInNewTab ? '_blank' : undefined}
          rel={openInNewTab ? 'noopener noreferrer' : undefined}
        >
          {content}
        </Link>
      );
    }

    return (
      <div className={className} onClick={onClick}>
        {content}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-500 delay-100">
      <h3 className="text-lg font-medium flex items-center gap-2">
        <FolderOpen className="h-5 w-5" />
        System & Metadata
      </h3>

      <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <InfoRow
          icon={FolderOpen}
          title="File Manager"
          description={`Browse files at ${application.location}`}
          href={withSelectedServer(`/server/files?path=${encodeURIComponent(application.location)}`)}
          openInNewTab
        />

        <InfoRow
          icon={ScrollText}
          title="Terminal Output"
          description={outputLogPath}
          href={withSelectedServer(`/server/viewer?path=${encodeURIComponent(outputLogPath)}&type=text`)}
          openInNewTab
        />

        <InfoRow
          icon={AlertCircle}
          title="Error Log"
          description={errorLogPath}
          href={withSelectedServer(`/server/viewer?path=${encodeURIComponent(errorLogPath)}&type=text`)}
          openInNewTab
        />

        <InfoRow
          icon={Network}
          title="Network Access"
          description={portsDescription}
          isLast
        />
      </Card>
    </div>
  );
}
