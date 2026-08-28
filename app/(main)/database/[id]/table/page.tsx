import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Database, Table as TableIcon, Eye } from 'lucide-react';
import { Card } from '#/components/ui/card';
import { Badge } from '#/components/ui/badge';
import { PageTitleBack } from '@/components/page-header';
import { getDatabaseById } from '@/services/database/data';
import { listConnectionRelations } from '@/services/database/explorer';

export const metadata: Metadata = {
  title: 'Database Tables, Neup.Cloud',
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DatabaseTablesAndViewsPage({ params }: Props) {
  const { id } = await params;
  const connection = await getDatabaseById(id);

  if (!connection) {
    notFound();
  }

  let relations = [] as Awaited<ReturnType<typeof listConnectionRelations>>;
  let errorMessage = '';

  try {
    relations = await listConnectionRelations(connection);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Unable to fetch tables and views.';
  }

  return (
    <div className="grid gap-6 pb-20">
      <PageTitleBack
        backHref={`/database/${connection.id}`}
        title={connection.connectionType === 'firestore' ? 'Collections' : 'Tables and Views'}
        description={`Browsing relation list for ${connection.title}`}
      />

      <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        {errorMessage ? (
          <div className="p-8 text-center text-muted-foreground">{errorMessage}</div>
        ) : relations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No tables or views found.</div>
        ) : (
          relations.map((relation, index) => (
            <Link
              key={`${relation.type}-${relation.name}`}
              href={`/database/${connection.id}/table/${encodeURIComponent(relation.name)}`}
              className="block"
            >
              <div className={`p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 ${index !== relations.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {relation.type === 'view' ? <Eye className="h-5 w-5" /> : <TableIcon className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate font-mono">{relation.name}</h3>
                    <Badge variant="outline" className="text-[10px] uppercase">{relation.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Database className="h-3.5 w-3.5" />
                    {connection.connectionType === 'firestore' ? 'Open and view collection documents' : 'Open and view paginated data'}
                  </p>
                </div>
                <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}
