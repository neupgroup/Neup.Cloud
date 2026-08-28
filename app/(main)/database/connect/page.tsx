"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PageTitleBack } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card';
import { Input } from '#/components/ui/input';
import { Textarea } from '#/components/ui/textarea';
import { Button } from '#/components/ui/button';
import { useToast } from '#/core/hooks/useToast';
import { createDatabaseConnection } from '@/services/database/management';
import type { DatabaseConnectionType } from '@/services/database/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select';

const INITIAL_AUTH_STATE: Record<DatabaseConnectionType, Record<string, string>> = {
  postgres: { host: '', port: '5432', database: '', username: '', password: '', ssl: '' },
  mysql: { host: '', port: '3306', database: '', username: '', password: '' },
  mariadb: { host: '', port: '3306', database: '', username: '', password: '' },
  sqlite: { filePath: '' },
  firestore: { projectId: '', clientEmail: '', privateKey: '', databaseId: '(default)' },
};

export default function ConnectDatabasePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [connectionType, setConnectionType] = useState<DatabaseConnectionType>('postgres');
  const [authByType, setAuthByType] = useState(INITIAL_AUTH_STATE);
  const [isSaving, setIsSaving] = useState(false);

  const currentAuth = authByType[connectionType];

  const setAuthValue = (field: string, value: string) => {
    setAuthByType((previous) => ({
      ...previous,
      [connectionType]: {
        ...previous[connectionType],
        [field]: value,
      },
    }));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSaving(true);
    try {
      await createDatabaseConnection({
        title,
        description,
        connectionType,
        authConfig: currentAuth,
      });

      toast({
        title: 'Database connected',
        description: 'External database details were saved successfully.',
      });

      router.push('/database');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Unable to connect database',
        description: error?.message || 'Please verify the information and try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageTitleBack title="Connect Database" backHref="/database" />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Connect an External Database</CardTitle>
          <CardDescription>
            This stores database details from other servers or service providers. It does not create a new local database.
          </CardDescription>
        </CardHeader>

        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="database-title" className="text-sm font-medium">Title</label>
              <Input
                id="database-title"
                placeholder="Production PostgreSQL"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="database-description" className="text-sm font-medium">Description</label>
              <Textarea
                id="database-description"
                placeholder="Main customer data stored on AWS RDS in us-east-1"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="connection-type" className="text-sm font-medium">Type of connection</label>
              <Select value={connectionType} onValueChange={(value) => setConnectionType(value as DatabaseConnectionType)}>
                <SelectTrigger id="connection-type">
                  <SelectValue placeholder="Select connection type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="postgres">Postgres</SelectItem>
                  <SelectItem value="mysql">MySQL</SelectItem>
                  <SelectItem value="mariadb">MariaDB</SelectItem>
                  <SelectItem value="sqlite">SQLite</SelectItem>
                  <SelectItem value="firestore">Firestore</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(connectionType === 'postgres' || connectionType === 'mysql' || connectionType === 'mariadb') && (
              <>
                <div className="space-y-2">
                  <label htmlFor="host" className="text-sm font-medium">Host</label>
                  <Input id="host" value={currentAuth.host || ''} onChange={(event) => setAuthValue('host', event.target.value)} disabled={isSaving} placeholder="db.example.com" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="port" className="text-sm font-medium">Port</label>
                  <Input id="port" value={currentAuth.port || ''} onChange={(event) => setAuthValue('port', event.target.value)} disabled={isSaving} placeholder={connectionType === 'postgres' ? '5432' : '3306'} />
                </div>
                <div className="space-y-2">
                  <label htmlFor="database-name" className="text-sm font-medium">Database name</label>
                  <Input id="database-name" value={currentAuth.database || ''} onChange={(event) => setAuthValue('database', event.target.value)} disabled={isSaving} placeholder="app_production" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm font-medium">Username</label>
                  <Input id="username" value={currentAuth.username || ''} onChange={(event) => setAuthValue('username', event.target.value)} disabled={isSaving} placeholder="db_user" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">Password</label>
                  <Input id="password" type="password" value={currentAuth.password || ''} onChange={(event) => setAuthValue('password', event.target.value)} disabled={isSaving} placeholder="********" />
                </div>
                {connectionType === 'postgres' && (
                  <div className="space-y-2">
                    <label htmlFor="ssl" className="text-sm font-medium">SSL (optional)</label>
                    <Input id="ssl" value={currentAuth.ssl || ''} onChange={(event) => setAuthValue('ssl', event.target.value)} disabled={isSaving} placeholder="true" />
                  </div>
                )}
              </>
            )}

            {connectionType === 'sqlite' && (
              <div className="space-y-2">
                <label htmlFor="sqlite-file-path" className="text-sm font-medium">SQLite file path</label>
                <Input
                  id="sqlite-file-path"
                  value={currentAuth.filePath || ''}
                  onChange={(event) => setAuthValue('filePath', event.target.value)}
                  disabled={isSaving}
                  placeholder="/var/data/app.sqlite"
                />
              </div>
            )}

            {connectionType === 'firestore' && (
              <>
                <div className="space-y-2">
                  <label htmlFor="firestore-project-id" className="text-sm font-medium">Project ID</label>
                  <Input
                    id="firestore-project-id"
                    value={currentAuth.projectId || ''}
                    onChange={(event) => setAuthValue('projectId', event.target.value)}
                    disabled={isSaving}
                    placeholder="my-gcp-project"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="firestore-client-email" className="text-sm font-medium">Client Email</label>
                  <Input
                    id="firestore-client-email"
                    value={currentAuth.clientEmail || ''}
                    onChange={(event) => setAuthValue('clientEmail', event.target.value)}
                    disabled={isSaving}
                    placeholder="firebase-adminsdk-xyz@my-gcp-project.iam.gserviceaccount.com"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="firestore-private-key" className="text-sm font-medium">Private Key</label>
                  <Textarea
                    id="firestore-private-key"
                    value={currentAuth.privateKey || ''}
                    onChange={(event) => setAuthValue('privateKey', event.target.value)}
                    disabled={isSaving}
                    placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="firestore-database-id" className="text-sm font-medium">Database ID (optional)</label>
                  <Input
                    id="firestore-database-id"
                    value={currentAuth.databaseId || ''}
                    onChange={(event) => setAuthValue('databaseId', event.target.value)}
                    disabled={isSaving}
                    placeholder="(default)"
                  />
                </div>
              </>
            )}

            <Button htmlType="submit" disabled={isSaving} className="w-full">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSaving ? 'Connecting...' : 'Connect Database'}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
