'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Download, AlertTriangle, ArrowLeft, Shield, ShieldOff } from 'lucide-react';
import { getFileContent, saveFileContent } from './actions';
import { useToast } from '../../hooks/use-toast';
import { PageTitleBack } from '@/components/page-header';

export default function ViewerClient({ serverId }: { serverId: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const path = searchParams.get('path');
    const type = searchParams.get('type'); // 'image', 'video', 'text', 'code'
    // const app = searchParams.get('app'); // Unused for now, but part of spec

    const { toast } = useToast();
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isBinary, setIsBinary] = useState(false);

    const rootMode = searchParams.get('rootMode') === 'true';
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [content]);

    // Determines if we should treat it as binary based on type or extension
    useEffect(() => {
        if (!path) return;

        const checkBinary = () => {
            if (type === 'image' || type === 'video') return true;
            // Fallback extension check
            const ext = path.split('.').pop()?.toLowerCase();
            const binaryExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm', 'pdf', 'zip', 'tar', 'gz'];
            return binaryExts.includes(ext || '');
        };
        setIsBinary(checkBinary());
    }, [path, type]);



    useEffect(() => {
        if (!serverId || !path) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);

            let binary = false;
            if (type === 'image' || type === 'video') binary = true;
            else {
                const ext = path.split('.').pop()?.toLowerCase();
                if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm'].includes(ext || '')) binary = true;
            }

            const result = await getFileContent(serverId, path, binary, rootMode);
            if (result.error) {
                setError(result.error);
            } else {
                setContent(result.content || '');
            }
            setLoading(false);
        };

        fetchData();
    }, [serverId, path, type, rootMode]);

    const handleSave = async () => {
        if (!path || content === null) return;
        setSaving(true);
        const result = await saveFileContent(serverId, path, content, rootMode);
        if (result.error) {
            toast({ variant: 'destructive', title: 'Error saving file', description: result.error });
        } else {
            toast({ title: 'Success', description: 'File saved successfully.' });
        }
        setSaving(false);
    };

    const handleRootModeToggle = () => {
        const newRootMode = !rootMode;
        const params = new URLSearchParams(searchParams.toString());
        params.set('rootMode', newRootMode.toString());
        router.push(window.location.pathname + '?' + params.toString());
        toast({
            title: newRootMode ? 'Root Mode Enabled' : 'Root Mode Disabled',
            description: newRootMode ? 'File operations will now use sudo.' : 'File operations will run with normal permissions.',
        });
    };

    if (!path) return <div className="p-8 text-center">No file path specified.</div>;

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading content...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 flex flex-col items-center justify-center text-destructive">
                <AlertTriangle className="h-12 w-12 mb-4" />
                <h2 className="text-xl font-bold">Error Loading File</h2>
                <p>{error}</p>
            </div>
        );
    }

    // Render logic based on type
    const renderContent = () => {
        if (type === 'image') {
            const ext = path.split('.').pop()?.toLowerCase();
            let mime = 'image/jpeg';
            if (ext === 'png') mime = 'image/png';
            if (ext === 'gif') mime = 'image/gif';
            if (ext === 'webp') mime = 'image/webp';
            if (ext === 'svg') mime = 'image/svg+xml';

            return (
                <div className="flex justify-center bg-muted/10 items-center rounded-lg border shadow-sm overflow-hidden w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={`data:${mime};base64,${content}`}
                        alt={path}
                        className="max-w-full max-h-[calc(100vh-200px)] w-auto h-auto object-contain shadow-sm rounded bg-checkerboard"
                    />
                </div>
            );
        }

        if (type === 'video') {
            const ext = path.split('.').pop()?.toLowerCase();
            let mime = 'video/mp4';
            if (ext === 'webm') mime = 'video/webm';

            return (
                <div className="flex justify-center bg-black items-center rounded-lg border shadow-sm overflow-hidden w-full">
                    <video controls className="max-w-full max-h-[calc(100vh-200px)] w-auto h-auto object-contain rounded shadow-sm">
                        <source src={`data:${mime};base64,${content}`} type={mime} />
                        Your browser does not support the video tag.
                    </video>
                </div>
            )
        }

        // Text or Code
        return (
            <div className="relative rounded-lg border shadow-sm bg-background">
                <textarea
                    ref={textareaRef}
                    className="w-full p-6 font-mono text-sm bg-transparent border-none focus:ring-0 focus:outline-none resize-none overflow-hidden min-h-[60vh]"
                    value={content || ''}
                    onChange={(e) => setContent(e.target.value)}
                    spellCheck={false}
                />
            </div>
        );
    };

    const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
    const backHref = `/server/files?path=${encodeURIComponent(parentPath)}${rootMode ? '&rootMode=true' : ''}`;

    return (
        <div className="space-y-6 pb-24">
            {/* Responsive Header */}
            <div className="flex flex-col gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-fit -ml-2 text-muted-foreground hover:text-foreground"
                    onClick={() => router.push(backHref)}
                >
                    <ArrowLeft className="mr-1 h-4 w-4" /> Back to Files
                </Button>

                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-all">
                        {path.split('/').pop() || 'Unknown File'}
                    </h1>

                    <div className="flex items-center gap-x-1 gap-y-1 text-sm text-muted-foreground flex-wrap">
                        <span className="font-semibold text-foreground mr-1">Location:</span>
                        <Button
                            variant="link"
                            className="p-0 h-auto text-muted-foreground font-normal hover:text-primary"
                            onClick={() => router.push(`/server/files?path=/${rootMode ? '&rootMode=true' : ''}`)}
                        >
                            root
                        </Button>
                        {path.split('/').filter(Boolean).map((segment, index, array) => {
                            const isLast = index === array.length - 1;
                            const segmentPath = '/' + array.slice(0, index + 1).join('/');

                            return (
                                <React.Fragment key={index}>
                                    <span className="text-muted-foreground/40 mx-0.5">&gt;</span>
                                    {isLast ? (
                                        <span className="text-foreground break-all">{segment}</span>
                                    ) : (
                                        <Button
                                            variant="link"
                                            className="p-0 h-auto text-muted-foreground font-normal hover:text-primary max-w-[150px] truncate"
                                            onClick={() => router.push(`/server/files?path=${encodeURIComponent(segmentPath)}${rootMode ? '&rootMode=true' : ''}`)}
                                        >
                                            {segment}
                                        </Button>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-4">
                {/* Root Mode Indicator */}
                {rootMode && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 text-sm">
                        <Shield className="h-4 w-4 text-amber-500" />
                        <span className="font-medium text-amber-600 dark:text-amber-400">Root Mode Active</span>
                        <span className="text-muted-foreground">- File operations will use sudo</span>
                    </div>
                )}

                {renderContent()}

                {!isBinary && (
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-8">
                        <Button
                            onClick={handleRootModeToggle}
                            variant="outline"
                            size="lg"
                            className="w-full sm:w-auto"
                        >
                            {rootMode ? (
                                <><ShieldOff className="mr-2 h-4 w-4" /> Turn Root Off</>
                            ) : (
                                <><Shield className="mr-2 h-4 w-4" /> Turn Root On</>
                            )}
                        </Button>
                        <Button onClick={handleSave} disabled={saving} size="lg" className="w-full sm:w-auto">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Changes
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
