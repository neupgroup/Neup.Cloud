
import React from 'react';
import { cn } from '#/core/utils';
import { ServerNameLink } from '@/components/server-name-link';
import { BackButton } from '#/components/element/backButton';

interface PageTitleProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    serverName?: string | null;
    className?: string;
    children?: React.ReactNode;
}

export function PageTitle({ title, description, serverName, className, children }: PageTitleProps) {
    const displayDescription = serverName && description ? (
        <>{description} on <ServerNameLink name={serverName} /></>
    ) : description;

    return (
        <div className={cn("space-y-1.5", className)}>
            <div className="flex items-center justify-between">
                <h1 className="min-w-0 break-words text-3xl font-bold font-headline tracking-tight">{title}</h1>
                {children}
            </div>
            {displayDescription && <div className="break-words text-muted-foreground text-lg">{displayDescription}</div>}
        </div>
    );
}

interface PageTitleBackProps extends PageTitleProps {
    backHref: string;
}

export function PageTitleBack({ title, description, serverName, backHref, className, children }: PageTitleBackProps) {
    const displayDescription = serverName && description ? (
        <>{description} on <ServerNameLink name={serverName} /></>
    ) : description;

    return (
        <div className={cn("space-y-2", className)}>
            <BackButton backsTo={backHref} />
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold font-headline tracking-tight">{title}</h1>
                    {children}
                </div>
                {displayDescription && <div className="text-muted-foreground text-lg">{displayDescription}</div>}
            </div>
        </div>
    );
}

interface PageTitleWithComponentProps extends PageTitleProps {
    actionComponent: React.ReactNode;
}

export function PageTitleWithComponent({ title, description, serverName, className, actionComponent, children }: PageTitleWithComponentProps) {
    const displayDescription = serverName && description ? (
        <>{description} on <ServerNameLink name={serverName} /></>
    ) : description;

    return (
        <div className={cn("space-y-1.5", className)}>
            <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold font-headline tracking-tight">{title}</h1>
                {actionComponent}
                {children && <div className="ml-auto">{children}</div>}
            </div>
            {displayDescription && <div className="text-muted-foreground text-lg">{displayDescription}</div>}
        </div>
    );
}

interface PageTitleBackWithComponentProps extends PageTitleBackProps {
    actionComponent: React.ReactNode;
}

export function PageTitleBackWithComponent({ title, description, serverName, backHref, className, actionComponent, children }: PageTitleBackWithComponentProps) {
    const displayDescription = serverName && description ? (
        <>{description} on <ServerNameLink name={serverName} /></>
    ) : description;

    return (
        <div className={cn("space-y-2", className)}>
            <BackButton backsTo={backHref} />
            <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold font-headline tracking-tight">{title}</h1>
                    {actionComponent}
                    {children && <div className="ml-auto">{children}</div>}
                </div>
                {displayDescription && <div className="text-muted-foreground text-lg">{displayDescription}</div>}
            </div>
        </div>
    );
}
