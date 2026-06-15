'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { PageTitle } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/core/hooks/use-toast';
import { cn } from '@/core/utils';
import { searchFilesOnServer } from '@/services/server/server-file-service';
import type { FileSearchResult } from '@/services/server/server-file-types';
import { ExternalLink, FileSearch, FolderOpen, Loader2, Shield, ShieldOff } from 'lucide-react';
import { useSelectedServerId } from '@/core/hooks/use-selected-server';
import { useServerName } from '@/core/hooks/use-server-name';

function formatBytes(bytes: number | null) {
  if (!bytes || bytes <= 0) return '-';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  const formatted = value >= 10 || i === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[i]}`;
}

function guessViewerType(filePath: string) {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
  const videoExts = ['mp4', 'webm', 'mov'];
  const codeExts = ['js', 'ts', 'tsx', 'jsx', 'css', 'html', 'json', 'py', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'sh', 'yaml', 'yml', 'toml', 'xml', 'md', 'env', 'gitignore', 'conf', 'ini'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (codeExts.includes(ext)) return 'code';
  return 'text';
}

function splitExtensions(input: string) {
  return input
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default function ServerSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const selectedServerId = useSelectedServerId();
  const serverName = useServerName();

  const rootMode = searchParams.get('rootMode') === 'true';
  const initialBasePath = searchParams.get('path') || '/home';

  const [serverId, setServerId] = useState<string | null>(null);
  const [serverReady, setServerReady] = useState(false);

  const [basePath, setBasePath] = useState(initialBasePath);
  const [query, setQuery] = useState('');
  const [extensions, setExtensions] = useState('');
  const [limit, setLimit] = useState(200);

  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<FileSearchResult[]>([]);
  const [truncated, setTruncated] = useState(false);

  const extensionsList = useMemo(() => splitExtensions(extensions), [extensions]);

  useEffect(() => {
    document.title = 'Search Files, Neup.Cloud';
  }, []);

  useEffect(() => {
    setServerId(selectedServerId);
    setServerReady(true);
  }, [selectedServerId]);

  useEffect(() => {
    setBasePath(initialBasePath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBasePath]);

  const setUrlParam = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(name, value);
    router.push(`/server/search?${params.toString()}`);
  };

  const handleRootModeToggle = () => {
    setUrlParam('rootMode', (!rootMode).toString());
    toast({
      title: !rootMode ? 'Root Mode Enabled' : 'Root Mode Disabled',
      description: !rootMode ? 'Search will run with sudo.' : 'Search will run with normal permissions.',
    });
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!serverId) return;

    setIsSearching(true);
    setResults([]);
    setTruncated(false);

    try {
      const { results: found, truncated: isTruncated, error } = await searchFilesOnServer(
        serverId,
        basePath,
        query,
        extensionsList,
        rootMode,
        limit
      );

      if (error) {
        toast({ variant: 'destructive', title: 'Search failed', description: error });
        setResults([]);
        setTruncated(false);
        return;
      }

      setResults(found);
      setTruncated(isTruncated);
      if (isTruncated) {
        toast({ title: 'Results truncated', description: `Showing first ${limit} results.` });
      }
    } finally {
      setIsSearching(false);
    }
  };

  if (!serverReady) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading server selection...</span>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageTitle
        title="Search Files"
        description="Search by filename and filter by extensions."
        serverName={serverName}
      />

      {!serverId ? (
        <Card className="text-center p-8">
          <FileSearch className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No Server Selected</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Please go to the servers page and select a server to search.
          </p>
          <Button asChild className="mt-4">
            <Link href="/servers">Go to Servers</Link>
          </Button>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <FileSearch className="h-5 w-5 text-muted-foreground" />
                  Search
                </span>
                <Button variant="outline" onClick={handleRootModeToggle}>
                  {rootMode ? (
                    <>
                      <ShieldOff className="mr-2 h-4 w-4" /> Turn Root Off
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" /> Turn Root On
                    </>
                  )}
                </Button>
              </CardTitle>
              <CardDescription>
                Default is <span className="font-mono">/home</span>. This searches recursively under the selected base path.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="basePath">Base path</Label>
                  <Input
                    id="basePath"
                    value={basePath}
                    onChange={(e) => setBasePath(e.target.value)}
                    onBlur={() => setUrlParam('path', basePath)}
                    placeholder="/home"
                    className="font-mono"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="query">Filename contains</Label>
                  <Input
                    id="query"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. invoice, report, docker, .env"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="extensions">Extensions (comma-separated)</Label>
                  <Input
                    id="extensions"
                    value={extensions}
                    onChange={(e) => setExtensions(e.target.value)}
                    placeholder="e.g. pdf, docx, png, ts, log"
                    className="font-mono"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="limit">Max results</Label>
                  <Input
                    id="limit"
                    inputMode="numeric"
                    value={String(limit)}
                    onChange={(e) => setLimit(Math.max(1, Math.min(2000, Number(e.target.value || 200))))}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button type="submit" disabled={isSearching} className="w-full sm:w-auto">
                    {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
                    Search
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setQuery('');
                      setExtensions('');
                      setResults([]);
                      setTruncated(false);
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Results</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {results.length} {results.length === 1 ? 'file' : 'files'}
                  {truncated ? ' (truncated)' : ''}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isSearching ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </div>
              ) : results.length === 0 ? (
                <div className="text-sm text-muted-foreground">No results yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead className="hidden md:table-cell">Directory</TableHead>
                      <TableHead className="hidden lg:table-cell">Size</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((item) => {
                      const viewerHref = `/server/viewer?path=${encodeURIComponent(item.path)}&type=${guessViewerType(item.path)}${rootMode ? '&rootMode=true' : ''}`;
                      const openFilesHref = `/server/files?path=${encodeURIComponent(item.directory)}${rootMode ? '&rootMode=true' : ''}`;

                      return (
                        <TableRow
                          key={item.path}
                          className="cursor-pointer"
                          onClick={() => router.push(viewerHref)}
                        >
                          <TableCell className="max-w-[420px]">
                            <Link
                              href={viewerHref}
                              onClick={(e) => e.stopPropagation()}
                              className={cn('font-medium hover:underline break-all')}
                              title={item.path}
                            >
                              {item.name}
                            </Link>
                            <div className="text-xs text-muted-foreground font-mono break-all mt-1">
                              {item.path}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell max-w-[380px]">
                            <span className="font-mono text-xs break-all text-muted-foreground">{item.directory}</span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-sm text-muted-foreground">{formatBytes(item.size)}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button asChild variant="outline" size="sm">
                                <Link href={viewerHref} onClick={(e) => e.stopPropagation()}>
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Open
                                </Link>
                              </Button>
                              <Button asChild variant="secondary" size="sm">
                                <Link
                                  href={openFilesHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <FolderOpen className="mr-2 h-4 w-4" />
                                  Open in Files
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
