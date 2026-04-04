
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Database, Globe, Copy, CheckCircle, Shield, Code, Server } from "lucide-react";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import { PageTitleBack } from "@/components/page-header";
import type { Metadata } from 'next';
import { Badge } from "@/components/ui/badge";
import { getDatabaseDetails } from "@/actions/database";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
    title: 'Database Connection | Neup.Cloud',
};

type Props = {
    params: Promise<{ id: string }>
}

export default async function DatabaseConnectionPage({ params }: Props) {
    const { id } = await params;
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;

    if (!serverId) notFound();

    // Parse ID: Format is "engine-name"
    const parts = id.split('-');
    if (parts.length < 2) notFound();

    const engine = parts[0] as 'mariadb' | 'postgres';
    const dbName = parts.slice(1).join('-');

    let details = null;
    try {
        details = await getDatabaseDetails(serverId, engine, dbName);
    } catch (error) {
        console.error(error);
        notFound();
    }

    const isMariaDB = details.engine === 'mariadb';
    const port = isMariaDB ? '3306' : '5432';
    const host = `${details.name}.neup.cloud`;

    return (
        <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            <PageTitleBack
                backHref={`/server/database/${id}`}
                title={
                    <span className="flex items-center gap-3">
                        <span className="p-2.5 bg-primary/10 rounded-xl">
                            <Globe className="w-6 h-6 text-primary" />
                        </span>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="font-bold tracking-tight">Connection Guide</span>
                            </div>
                            <span className="text-sm font-normal text-muted-foreground">{details.name}</span>
                        </div>
                    </span>
                }
            />

            {/* Connection Status */}
            <Card className="border-2 border-green-500/20 bg-green-500/5">
                <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                        <div className="p-2 rounded-lg bg-green-500/10">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold mb-1">Remote Access Enabled</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                                This database is configured to accept external connections. SSL encryption can be configured in settings.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                                    <Shield className="h-3 w-3 mr-1" />
                                    SSL Supported
                                </Badge>
                                <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
                                    <Server className="h-3 w-3 mr-1" />
                                    Port {port}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Connection Details */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary" />
                        Connection Details
                    </CardTitle>
                    <CardDescription>
                        Use these credentials to connect to your database
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Host</label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm">{host}</code>
                                    <Button variant="outline" size="icon" className="shrink-0">
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Port</label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm">{port}</code>
                                    <Button variant="outline" size="icon" className="shrink-0">
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Database Name</label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm">{details.name}</code>
                                    <Button variant="outline" size="icon" className="shrink-0">
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Username</label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm">owner</code>
                                    <Button variant="outline" size="icon" className="shrink-0">
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Connection Examples */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Code className="h-5 w-5 text-primary" />
                        Connection Examples
                    </CardTitle>
                    <CardDescription>
                        Code snippets for connecting from different environments. SSL settings can be configured in Database Settings.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* CLI */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Command Line</label>
                            <Button variant="ghost" size="sm" className="gap-2">
                                <Copy className="h-3 w-3" />
                                Copy
                            </Button>
                        </div>
                        <div className="p-4 bg-black rounded-lg font-mono text-xs text-green-400 overflow-x-auto">
                            {isMariaDB ? (
                                <pre>{`mysql -h ${host} -P ${port} -u owner -p ${details.name}`}</pre>
                            ) : (
                                <pre>{`psql "postgresql://owner@${host}:${port}/${details.name}?sslmode=require"`}</pre>
                            )}
                        </div>
                    </div>

                    {/* Node.js */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Node.js ({isMariaDB ? 'mysql2' : 'pg'})</label>
                            <Button variant="ghost" size="sm" className="gap-2">
                                <Copy className="h-3 w-3" />
                                Copy
                            </Button>
                        </div>
                        <div className="p-4 bg-black rounded-lg font-mono text-xs text-green-400 overflow-x-auto">
                            {isMariaDB ? (
                                <pre>{`const mysql = require('mysql2/promise');

const connection = await mysql.createConnection({
  host: '${host}',
  port: ${port},
  user: 'owner',
  password: 'your_password',
  database: '${details.name}',
  ssl: { rejectUnauthorized: true }
});`}</pre>
                            ) : (
                                <pre>{`const { Client } = require('pg');

const client = new Client({
  host: '${host}',
  port: ${port},
  user: 'owner',
  password: 'your_password',
  database: '${details.name}',
  ssl: { rejectUnauthorized: true }
});

await client.connect();`}</pre>
                            )}
                        </div>
                    </div>

                    {/* Python */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Python ({isMariaDB ? 'mysql-connector' : 'psycopg2'})</label>
                            <Button variant="ghost" size="sm" className="gap-2">
                                <Copy className="h-3 w-3" />
                                Copy
                            </Button>
                        </div>
                        <div className="p-4 bg-black rounded-lg font-mono text-xs text-green-400 overflow-x-auto">
                            {isMariaDB ? (
                                <pre>{`import mysql.connector

connection = mysql.connector.connect(
    host='${host}',
    port=${port},
    user='owner',
    password='your_password',
    database='${details.name}',
    ssl_verify_cert=True
)`}</pre>
                            ) : (
                                <pre>{`import psycopg2

connection = psycopg2.connect(
    host='${host}',
    port=${port},
    user='owner',
    password='your_password',
    database='${details.name}',
    sslmode='require'
)`}</pre>
                            )}
                        </div>
                    </div>

                    {/* PHP */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">PHP (PDO)</label>
                            <Button variant="ghost" size="sm" className="gap-2">
                                <Copy className="h-3 w-3" />
                                Copy
                            </Button>
                        </div>
                        <div className="p-4 bg-black rounded-lg font-mono text-xs text-green-400 overflow-x-auto">
                            {isMariaDB ? (
                                <pre>{`$dsn = "mysql:host=${host};port=${port};dbname=${details.name}";
$options = [
    PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => true,
];

$pdo = new PDO($dsn, 'owner', 'your_password', $options);`}</pre>
                            ) : (
                                <pre>{`$dsn = "pgsql:host=${host};port=${port};dbname=${details.name};sslmode=require";

$pdo = new PDO($dsn, 'owner', 'your_password');`}</pre>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
