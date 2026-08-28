"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Link2, ChevronRight, ShieldCheck } from 'lucide-react';
import { PageTitle } from '@/components/page-header';
import { Card } from '@/component/ui/card';
import { Input } from '@/component/ui/input';
import { Badge } from '@/component/ui/badge';
import { cn } from '@/core/utils';
import { getDatabases } from '@/services/database/database-service';
import type { ExternalDatabase } from '@/services/database/types';

export default function DatabasePage() {
  const router = useRouter();
  const [databases, setDatabases] = useState<ExternalDatabase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadDatabases = async () => {
      setIsLoading(true);
      try {
        const data = await getDatabases();
        setDatabases(data);
      } finally {
        setIsLoading(false);
      }
    };

    loadDatabases();
  }, []);

  const filteredDatabases = databases.filter((database) => {
    const term = searchQuery.toLowerCase();
    return (
      database.title.toLowerCase().includes(term) ||
      database.description.toLowerCase().includes(term)
    );
  });

  return (
    <div className="grid gap-6">
      <PageTitle
        title="Databases"
        description="Connect and manage databases hosted on other servers and service providers."
      />

      <div className="relative">
        <Input
          placeholder="Search database connections..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      {!searchQuery && (
        <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
          <div
            className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer"
            onClick={() => router.push('/database/connect')}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between mb-0 h-8">
                <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                  Connect External Database
                </h3>
                <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                Save database details from other servers and providers like AWS RDS, Cloud SQL, or managed PostgreSQL services.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading databases...</div>
        ) : filteredDatabases.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {databases.length === 0
              ? 'No external database connections added yet.'
              : `No databases found matching "${searchQuery}".`}
          </div>
        ) : (
          filteredDatabases.map((database, index) => (
            <div
              key={database.id}
              className={cn(
                'p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer',
                index !== filteredDatabases.length - 1 && 'border-b border-border'
              )}
              onClick={() => router.push(`/database/${database.id}`)}
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Database className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold truncate">{database.title}</h3>
                  <Badge variant="outline" className="text-[10px] uppercase">{database.connectionType}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{database.description}</p>
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Link2 className="h-3.5 w-3.5" />
                    Connected via saved details
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Credentials stored
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
