'use client';

import { PlusCircle } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import { PageTitle } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { useServerName } from '@/hooks/use-server-name';
import { useToast } from '@/hooks/use-toast';
import { ApplicationCard } from "./application-card";
import { getApplications, syncApplicationsWithServer } from "./actions";
import { ApplicationCardSkeleton } from "./application-card-skeleton";
import { getProcessCardStatus, type ServerProcess } from './status';
import type { Application } from "./types";

function getStoredStatus(application: Application) {
  const syncInfo = application.information?.serverSync;

  if (!syncInfo || syncInfo.status !== 'matched') {
    return getProcessCardStatus(null);
  }

  return getProcessCardStatus({
    name: syncInfo.matchedProcessName || application.information?.supervisorServiceName || application.name,
    state: syncInfo.matchedProcessState || 'UNKNOWN',
    source: 'supervisor',
  });
}

export default function AppsPage() {
  const { toast } = useToast();
  const serverName = useServerName();
  const [applications, setApplications] = useState<Application[]>([]);
  const [serverOnlyApplications, setServerOnlyApplications] = useState<ServerProcess[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchApplications = async () => {
      setIsLoading(true);

      try {
        const appsData = await getApplications();
        if (!cancelled) {
          setApplications(appsData);
        }

        const syncResult = await syncApplicationsWithServer();
        if (!cancelled) {
          setApplications(syncResult.applications);
          setServerOnlyApplications(
            syncResult.serverOnlyApplications
              .slice()
              .sort((left, right) => left.name.localeCompare(right.name))
          );
        }
      } catch (err: any) {
        if (!cancelled) {
          toast({
            variant: "destructive",
            title: "Error fetching applications",
            description: err.message,
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchApplications();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  const items = [
    ...applications.map((application) => ({
      id: application.id,
      application,
      status: getStoredStatus(application),
      href: `/server/applications/${application.id}`,
      sourceLabel: undefined as string | undefined,
    })),
    ...serverOnlyApplications.map((process) => ({
      id: `${process.source}:${process.name}`,
      application: {
        id: `${process.source}:${process.name}`,
        name: process.name,
        appIcon: undefined,
        location: '',
        language: 'run.custom',
        owner: process.source,
      } satisfies Application,
      status: getProcessCardStatus(process),
      href: `/server/applications/${encodeURIComponent(`supervisor_${process.name}`)}`,
      sourceLabel: 'Supervisor',
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Applications" serverName={serverName} />

      <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <Link href="/server/applications/deploy" className="block p-4 border-b border-border hover:bg-muted/50 transition-colors group">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <PlusCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Deploy New Application</h3>
              <p className="text-sm text-muted-foreground">Deploy a new application to your infrastructure</p>
            </div>
          </div>
        </Link>

        <div>
          {isLoading ? (
            <div className="p-4 space-y-4">
              <ApplicationCardSkeleton />
              <ApplicationCardSkeleton />
              <ApplicationCardSkeleton />
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">You haven't deployed any applications yet.</div>
          ) : (
            items.map((item, index) => (
              <div key={item.id} className={index !== items.length - 1 ? "border-b border-border" : ""}>
                <ApplicationCard
                  application={item.application}
                  status={item.status}
                  href={item.href}
                  sourceLabel={item.sourceLabel}
                />
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
