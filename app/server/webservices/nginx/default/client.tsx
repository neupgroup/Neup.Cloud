'use client';

import { useState } from 'react';
import { PageTitleBack } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { generateDefaultSSLCertificate, deployDefaultNginxConfig } from './actions';
import { Loader2, Shield, FileCode, Download, Upload, CheckCircle2, Server, AlertCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DefaultNginxConfigClientProps {
    serverId: string;
    serverName: string;
}

export default function DefaultNginxConfigClient({ serverId, serverName }: DefaultNginxConfigClientProps) {
    const [loading, setLoading] = useState(false);
    const [deploying, setDeploying] = useState(false);
    const [certGenerated, setCertGenerated] = useState(false);
    const [generatedConfig, setGeneratedConfig] = useState('');
    const { toast } = useToast();

    // Fixed SSL directory and paths
    const sslDir = '/etc/nginx/ssl';
    const certPath = `${sslDir}/default.crt`;
    const keyPath = `${sslDir}/default.key`;

    const [redirectUrl, setRedirectUrl] = useState('https://neupgroup.com/cloud');

    const handleGenerateCertificate = async () => {
        if (!serverId.trim()) {
            toast({
                title: 'No Server Selected',
                description: 'Please select a server from the server switcher',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        try {
            const result = await generateDefaultSSLCertificate(serverId, certPath, keyPath);

            if (result.success) {
                setCertGenerated(true);
                toast({
                    title: 'Success',
                    description: 'SSL certificate generated successfully',
                    className: 'bg-green-600 border-green-700 text-white',
                });
            } else {
                toast({
                    title: 'Generation Failed',
                    description: result.error || 'Failed to generate SSL certificate',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'An unexpected error occurred',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateConfig = () => {
        const config = `# DEFAULT CATCH-ALL HANDLER
# File: default.conf
#
# Purpose:
# - Catch IP access & unknown domains
# - Redirect HTTP + HTTPS to ${redirectUrl}
# - No content served, ever

server {
    # HTTP
    listen 80 default_server;
    listen [::]:80 default_server;

    # HTTPS
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;

    # Catch-all
    server_name _;

    # SSL certificate paths
    ssl_certificate     ${certPath};
    ssl_certificate_key ${keyPath};

    # TLS hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache off;

    # Absolute redirect
    return 301 ${redirectUrl};
}
`;
        setGeneratedConfig(config);
    };

    const handleDeployConfig = async () => {
        if (!serverId.trim()) {
            toast({
                title: 'No Server Selected',
                description: 'Please select a server from the server switcher',
                variant: 'destructive',
            });
            return;
        }

        if (!generatedConfig.trim()) {
            toast({
                title: 'Validation Error',
                description: 'Please generate the configuration first',
                variant: 'destructive',
            });
            return;
        }

        setDeploying(true);
        try {
            const result = await deployDefaultNginxConfig(serverId, generatedConfig);

            if (result.success) {
                toast({
                    title: 'Success',
                    description: 'Default Nginx configuration deployed successfully',
                    className: 'bg-green-600 border-green-700 text-white',
                });
            } else {
                toast({
                    title: 'Deployment Failed',
                    description: result.error || 'Failed to deploy configuration',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'An unexpected error occurred',
                variant: 'destructive',
            });
        } finally {
            setDeploying(false);
        }
    };

    return (
        <div className="mr-auto w-full max-w-4xl space-y-8 animate-in fade-in duration-500 pb-20">
            <PageTitleBack
                title="Default Nginx Configuration"
                description="Generate self-signed SSL certificates and default catch-all configuration"
                backHref="/server/webservices/nginx"
            />

            {/* Server Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        Selected Server
                    </CardTitle>
                    <CardDescription>
                        Configuration will be deployed to this server
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {serverId ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                <div>
                                    <p className="font-medium">{serverName}</p>
                                    <p className="text-xs text-muted-foreground font-mono">{serverId}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                No server selected. Please select a server from the server switcher in the navigation.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* SSL Certificate Generation */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        SSL Certificate Generation
                    </CardTitle>
                    <CardDescription>
                        Generate a self-signed SSL certificate for the default server block
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>SSL Directory</Label>
                        <Input
                            value={sslDir}
                            disabled
                            className="font-mono text-sm bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">
                            Both certificate and key will be stored in this directory
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Certificate Path</Label>
                            <Input
                                value={certPath}
                                disabled
                                className="font-mono text-sm bg-muted"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Private Key Path</Label>
                            <Input
                                value={keyPath}
                                disabled
                                className="font-mono text-sm bg-muted"
                            />
                        </div>
                    </div>

                    <Button
                        onClick={handleGenerateCertificate}
                        disabled={loading || !serverId}
                        className="w-full"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating Certificate...
                            </>
                        ) : certGenerated ? (
                            <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Certificate Generated
                            </>
                        ) : (
                            <>
                                <Shield className="mr-2 h-4 w-4" />
                                Generate SSL Certificate
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Configuration Generation */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileCode className="h-5 w-5" />
                        Nginx Configuration
                    </CardTitle>
                    <CardDescription>
                        Generate the default catch-all Nginx configuration
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="redirectUrl">Redirect URL</Label>
                        <Input
                            id="redirectUrl"
                            placeholder="https://neupgroup.com/cloud"
                            value={redirectUrl}
                            onChange={(e) => setRedirectUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            All requests to this server will be redirected to this URL
                        </p>
                    </div>

                    <Button
                        onClick={handleGenerateConfig}
                        variant="outline"
                        className="w-full"
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Generate Configuration
                    </Button>

                    {generatedConfig && (
                        <div className="space-y-2">
                            <Label htmlFor="config">Generated Configuration</Label>
                            <Textarea
                                id="config"
                                value={generatedConfig}
                                onChange={(e) => setGeneratedConfig(e.target.value)}
                                className="font-mono text-xs min-h-[400px]"
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Deploy Configuration */}
            {generatedConfig && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            Deploy Configuration
                        </CardTitle>
                        <CardDescription>
                            Deploy the generated configuration to the server
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={handleDeployConfig}
                            disabled={deploying || !serverId || !certGenerated}
                            className="w-full"
                        >
                            {deploying ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deploying Configuration...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Deploy to Server
                                </>
                            )}
                        </Button>
                        {!certGenerated && (
                            <p className="text-xs text-muted-foreground mt-2">
                                Please generate the SSL certificate first
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
