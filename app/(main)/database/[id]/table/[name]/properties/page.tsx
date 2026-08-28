import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Settings2 } from 'lucide-react';
import { PageTitleBack } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert';
import { Button } from '#/components/ui/button';
import { Card } from '#/components/ui/card';
import { getDatabaseById } from '@/services/database/data';
import { getConnectionTableProperties } from '@/services/database/explorer';
import { TablePropertiesClient } from './properties-client';

export const metadata: Metadata = {
  title: 'Table Properties, Neup.Cloud',
};

type Props = {
  params: Promise<{ id: string; name: string }>;
};

export default async function DatabaseTablePropertiesPage({ params }: Props) {
  const { id, name } = await params;
  const connection = await getDatabaseById(id);

  if (!connection) {
    notFound();
  }

  const tableName = decodeURIComponent(name);

  try {
    const properties = await getConnectionTableProperties(connection, tableName);

    return (
      <div className="grid gap-6 pb-20">
        <PageTitleBack
          backHref={`/database/${connection.id}/table/${encodeURIComponent(tableName)}`}
          title={
            <span className="flex items-center gap-3">
              <span className="p-2.5 bg-primary/10 rounded-xl">
                <Settings2 className="w-6 h-6 text-primary" />
              </span>
              <span>{tableName} properties</span>
            </span>
          }
          description={`Manage indexes, primary keys, columns, and destructive actions for ${connection.title}`}
        >
          <Button variant="outline" asChild>
            <Link href={`/database/${connection.id}/table/${encodeURIComponent(tableName)}`}>
              Browse data
            </Link>
          </Button>
        </PageTitleBack>

        <TablePropertiesClient
          connectionId={connection.id}
          tableName={tableName}
          properties={properties}
        />
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load table properties.';

    return (
      <div className="grid gap-6 pb-20">
        <PageTitleBack
          backHref={`/database/${connection.id}/table/${encodeURIComponent(tableName)}`}
          title={`${tableName} properties`}
          description={`Manage indexes, primary keys, columns, and destructive actions for ${connection.title}`}
        />

        <Card className="p-6">
          <Alert variant="destructive">
            <AlertTitle>Unable to load properties</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        </Card>
      </div>
    );
  }
}
