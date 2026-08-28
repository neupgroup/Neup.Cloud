'use client';

import React, { useState, useEffect } from 'react';
import { generateNginxConfig, NginxLocation } from '@/services/core/nginx';
import { Plus, Trash, Copy, Check, FileCode } from 'lucide-react';
import { Textarea } from '#/components/ui/textarea';
import { Separator } from '#/components/ui/separator';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { Button } from '#/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '#/components/ui/card';
import { useToast } from '#/core/hooks/useToast';

interface NginxConfigGeneratorProps {
    defaultDomain?: string;
}

export function NginxConfigGenerator({ defaultDomain = 'example.com' }: NginxConfigGeneratorProps) {
    const { toast } = useToast();
    const [nginxDomain, setNginxDomain] = useState(defaultDomain);
    const [nginxPort, setNginxPort] = useState('80');
    const [nginxMainPort, setNginxMainPort] = useState('3000');
    const [nginxLocations, setNginxLocations] = useState<NginxLocation[]>([
        { path: '/', proxyPass: 'http://localhost:3000' }
    ]);
    const [generatedConfig, setGeneratedConfig] = useState('');
    const [copied, setCopied] = useState(false);

    // Update domain if default changes and we haven't touched it much (rudimentary check)
    useEffect(() => {
        if (defaultDomain && nginxDomain === 'example.com') {
            setNginxDomain(defaultDomain);
        }
    }, [defaultDomain]);

    const addLocation = () => {
        setNginxLocations([...nginxLocations, { path: '', proxyPass: '' }]);
    };

    const removeLocation = (index: number) => {
        const newLocs = [...nginxLocations];
        newLocs.splice(index, 1);
        setNginxLocations(newLocs);
    };

    const updateLocation = (index: number, field: keyof NginxLocation, value: any) => {
        const newLocs = [...nginxLocations];
        newLocs[index] = { ...newLocs[index], [field]: value };
        setNginxLocations(newLocs);
    };

    const handleGenerateConfig = () => {
        const config = generateNginxConfig({
            domain: nginxDomain,
            port: parseInt(nginxPort) || 80,
            mainAppPort: parseInt(nginxMainPort) || 3000,
            locations: nginxLocations
        });
        setGeneratedConfig(config);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedConfig);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({
            title: "Copied",
            description: "Configuration copied to clipboard",
        });
    };

    return (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-md">
                        <FileCode className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle>Nginx Configuration</CardTitle>
                        <CardDescription>Generate a server block for your proxy.</CardDescription>
                    </div>
                </div>

            </CardHeader>
            <CardContent className="grid gap-6">
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="nginx-domain">Domain Name</Label>
                        <Input
                            id="nginx-domain"
                            value={nginxDomain}
                            onChange={(e) => setNginxDomain(e.target.value)}
                            placeholder="example.com"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="nginx-port">Public Port</Label>
                        <Input
                            id="nginx-port"
                            value={nginxPort}
                            onChange={(e) => setNginxPort(e.target.value)}
                            placeholder="80"
                            type="number"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="nginx-main-port">Main App Port</Label>
                        <Input
                            id="nginx-main-port"
                            value={nginxMainPort}
                            onChange={(e) => setNginxMainPort(e.target.value)}
                            placeholder="3000"
                            type="number"
                        />
                    </div>
                </div>

                <Separator />

                <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-base">Proxy Paths & Locations</Label>
                        <Button htmlType="button" type="outlined" size="sm" onClick={addLocation}>
                            <Plus className="h-4 w-4 mr-2" /> Add Path
                        </Button>
                    </div>

                    {nginxLocations.map((loc, index) => (
                        <div key={index} className="grid md:grid-cols-[1fr_1fr_auto_auto] gap-4 items-end border p-4 rounded-md bg-muted/20">
                            <div className="grid gap-2">
                                <Label className="text-xs">Location Path</Label>
                                <Input
                                    value={loc.path}
                                    onChange={(e) => updateLocation(index, 'path', e.target.value)}
                                    placeholder="/app"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs">Target (Proxy Pass)</Label>
                                <Input
                                    value={loc.proxyPass || ''}
                                    onChange={(e) => updateLocation(index, 'proxyPass', e.target.value)}
                                    placeholder="http://localhost:4000"
                                    disabled={loc.isStatic}
                                />
                            </div>
                            <div className="flex items-center gap-2 pb-2">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id={`static-${index}`}
                                        className="h-4 w-4 rounded border-gray-300"
                                        checked={loc.isStatic || false}
                                        onChange={(e) => {
                                            updateLocation(index, 'isStatic', e.target.checked);
                                            if (e.target.checked) {
                                                updateLocation(index, 'proxyPass', undefined);
                                            }
                                        }}
                                    />
                                    <Label htmlFor={`static-${index}`} className="text-sm cursor-pointer whitespace-nowrap">Serve Locally</Label>
                                </div>
                            </div>
                            <Button htmlType="button" type="plain" size="icon" onClick={() => removeLocation(index)} className="text-muted-foreground hover:text-destructive">
                                <Trash className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>

                <Button htmlType="button" onClick={handleGenerateConfig} className="w-full sm:w-auto">
                    Generate Configuration
                </Button>

                {generatedConfig && (
                    <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between">
                            <Label>Generated Configuration</Label>
                            <Button htmlType="button" type="plain" size="sm" onClick={copyToClipboard}>
                                {copied ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <Copy className="h-4 w-4 mr-2" />}
                                {copied ? "Copied" : "Copy"}
                            </Button>
                        </div>
                        <Textarea
                            className="font-mono text-sm h-[400px]"
                            value={generatedConfig}
                            readOnly
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
