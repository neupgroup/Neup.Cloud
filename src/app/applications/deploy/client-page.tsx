'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PageTitleBack } from '@/components/page-header';
import { createApplication, generateRepositoryKeys } from '@/app/applications/actions';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash, X, Copy, ExternalLink, Key } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useServerName } from '@/hooks/use-server-name';

const FRAMEWORKS = [
  {
    id: 'next', name: 'Next.js', defaultCommands: [
      { name: 'start', description: 'Start the application', value: 'npm start' },
      { name: 'build', description: 'Build the application', value: 'npm run build' }
    ]
  },
  {
    id: 'node', name: 'Node.js', defaultCommands: [
      { name: 'start', description: 'Start the application', value: 'node index.js' }
    ]
  },
  {
    id: 'python', name: 'Python', defaultCommands: [
      { name: 'start', description: 'Start the application', value: 'python main.py' }
    ]
  },
  {
    id: 'go', name: 'Go', defaultCommands: [
      { name: 'build', description: 'Build the application', value: 'go build -o main .' },
      { name: 'start', description: 'Start the application', value: './main' }
    ]
  },
  { id: 'custom', name: 'Custom', defaultCommands: [] },
];

interface CommandItem {
  name: string;
  description: string;
  value: string; // This will be the raw value in state, encoded on save
}

export default function CreateApplicationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const serverName = useServerName();

  // Application Basics
  const [appName, setAppName] = useState('');
  const [appLocation, setAppLocation] = useState('');

  // Repository Info
  const [repoLocation, setRepoLocation] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [accessKey, setAccessKey] = useState('');
  const [username, setUsername] = useState('');
  const [generatedPublicKey, setGeneratedPublicKey] = useState<string | null>(null);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  // Language/Framework
  const [selectedFramework, setSelectedFramework] = useState('');

  // Network Info
  const [requiresNetwork, setRequiresNetwork] = useState(false);
  const [preferredPorts, setPreferredPorts] = useState<number[]>([]);
  const [portInput, setPortInput] = useState('');

  // Commands
  const [commands, setCommands] = useState<CommandItem[]>([]);

  // Custom Command Input State
  const [newCmdName, setNewCmdName] = useState('');
  const [newCmdDesc, setNewCmdDesc] = useState('');
  const [newCmdValue, setNewCmdValue] = useState('');

  const handleFrameworkChange = (val: string) => {
    setSelectedFramework(val);
    const fw = FRAMEWORKS.find(f => f.id === val);
    if (fw) {
      // Load default commands
      setCommands([...fw.defaultCommands]);
    } else {
      setCommands([]);
    }
  };

  const handlePortKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      const port = parseInt(portInput.trim());
      if (!isNaN(port) && port > 0 && port < 65536) {
        if (!preferredPorts.includes(port)) {
          setPreferredPorts([...preferredPorts, port]);
        }
      }
      setPortInput('');
    }
  };

  const removePort = (portToRemove: number) => {
    setPreferredPorts(preferredPorts.filter(p => p !== portToRemove));
  };

  const addCustomCommand = () => {
    if (!newCmdName.trim() || !newCmdValue.trim()) {
      toast({ title: "Validation Error", description: "Name and Command content are required.", variant: "destructive" });
      return;
    }
    setCommands([...commands, { name: newCmdName, description: newCmdDesc, value: newCmdValue }]);
    setNewCmdName('');
    setNewCmdDesc('');
    setNewCmdValue('');
  };

  const removeCommand = (index: number) => {
    setCommands(commands.filter((_, i) => i !== index));
  };

  const handleGenerateKey = async () => {
    setIsGeneratingKey(true);
    try {
      const keys = await generateRepositoryKeys();
      setAccessKey(keys.privateKey);
      setGeneratedPublicKey(keys.publicKey);
      toast({ title: "Key Generated", description: "New access key pair generated." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "Failed to generate key." });
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: "Public key copied to clipboard." });
  };

  // Improved submit handler to use the returned ID
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!appName || !appLocation || !selectedFramework) {
      toast({ variant: "destructive", title: "Missing fields", description: "Name, Location and Framework are required." });
      setIsLoading(false);
      return;
    }

    // Construct Reponse Objects
    const repoInfo = {
      location: repoLocation,
      isPrivate,
      accessKey: isPrivate ? accessKey : undefined,
      username: isPrivate ? username : undefined,
    };

    const networkInfo = {
      required: requiresNetwork,
      preferredPort: requiresNetwork ? preferredPorts : [],
    };

    const formattedCommands = commands.map(cmd => {
      let name = cmd.name;
      if (selectedFramework === 'custom') {
        if (['start', 'stop', 'restart', 'build'].includes(cmd.name.toLowerCase())) {
          name = `lifecycle.${cmd.name.toLowerCase()}`;
        }
      }
      return {
        name: name,
        description: cmd.description,
        value: btoa(cmd.value), // client side base64
      };
    });

    const simpleCommands: Record<string, string> = {};
    commands.forEach(cmd => {
      let key = cmd.name;
      // Logic from prompt: "if the command is part of the lifecycle command, then we save with the name lifecycle.name"
      // "but if the app is from framework or language defined and not custom, the lifecycle. will not work."
      // So ONLY for custom app we prefix? 
      // Or if the user overrides them? 
      // I will follow: if custom framework, prefix lifecycle commands.
      if (selectedFramework === 'custom') {
        if (['start', 'stop', 'restart', 'build'].includes(cmd.name.toLowerCase())) {
          key = `lifecycle.${cmd.name.toLowerCase()}`;
        }
      }
      simpleCommands[key] = cmd.value;
    });

    try {
      const appId = await createApplication({
        name: appName,
        location: appLocation,
        language: selectedFramework,
        repository: repoLocation,
        networkAccess: requiresNetwork ? preferredPorts.map(p => p.toString()) : undefined,
        commands: simpleCommands,
        information: {
          repoInfo,
          networkInfo,
          commandsList: formattedCommands,
        },
        owner: 'system',
      });

      router.push(`/applications/${appId}`);
      toast({ title: "Application Created", description: "Redirecting to application details..." });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "Could not create application." });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="container max-w-3xl py-8 space-y-8 animate-in fade-in duration-500">
      <PageTitleBack title="Deploy New Application" backHref="/applications" serverName={serverName} />

      <form onSubmit={onSubmit} className="space-y-8">

        {/* Application Basics */}
        <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Application Basics</CardTitle>
            <CardDescription>Essential details about your application.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="appName">Application Name</Label>
              <Input id="appName" placeholder="e.g. My Awesome App" value={appName} onChange={e => setAppName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="appLocation">Location in Server</Label>
              <Input id="appLocation" placeholder="/var/www/my-app" value={appLocation} onChange={e => setAppLocation(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Repository Information */}
        <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Repository Information</CardTitle>
            <CardDescription>Connect to your source code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="repoLocation">Repository URL (Optional)</Label>
              <Input id="repoLocation" placeholder="https://github.com/user/repo" value={repoLocation} onChange={e => setRepoLocation(e.target.value)} />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="isPrivate" checked={isPrivate} onCheckedChange={(c) => setIsPrivate(!!c)} />
              <Label htmlFor="isPrivate">Private Repository</Label>
            </div>

            {isPrivate && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                <div className="grid gap-2">
                  <Label htmlFor="accessKey">
                    Access Key / Private Key
                  </Label>
                  <div className="flex gap-2">
                    <Input id="accessKey" type="password" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" value={accessKey} onChange={e => setAccessKey(e.target.value)} />
                    <Button type="button" variant="outline" size="icon" onClick={handleGenerateKey} disabled={isGeneratingKey} title="Generate new key pair">
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                  {generatedPublicKey && (
                    <div className="mt-2 p-3 bg-muted rounded-md text-xs space-y-2 border border-primary/20 animate-in fade-in zoom-in-95">
                      <div className="flex items-center justify-between font-medium">
                        <span className="text-primary flex items-center gap-1.5">
                          <Key className="h-3 w-3" /> Public Key (Deploy Key)
                        </span>
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(generatedPublicKey)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="font-mono break-all text-muted-foreground bg-background p-2 rounded border">
                        {generatedPublicKey}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <a href="https://github.com/settings/ssh/new" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                          GitHub SSH Settings <ExternalLink className="h-3 w-3" />
                        </a>
                        <span className="text-muted-foreground hidden sm:inline">or</span>
                        <a href="https://gitlab.com/-/profile/keys" target="_blank" rel="noreferrer" className="text-orange-500 hover:underline flex items-center gap-1">
                          GitLab Keys <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="username">Username (Optional)</Label>
                  <Input id="username" placeholder="git-user" value={username} onChange={e => setUsername(e.target.value)} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Language / Framework */}
        <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Framework & Runtime</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedFramework} onValueChange={handleFrameworkChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a framework" />
              </SelectTrigger>
              <SelectContent>
                {FRAMEWORKS.map(fw => (
                  <SelectItem key={fw.id} value={fw.id}>{fw.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Network Information */}
        <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Network Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch id="requiresNetwork" checked={requiresNetwork} onCheckedChange={setRequiresNetwork} />
              <Label htmlFor="requiresNetwork">Requires Network Access</Label>
            </div>

            {requiresNetwork && (
              <div className="grid gap-2 animate-in slide-in-from-top-2">
                <Label htmlFor="ports">Preferred Ports</Label>
                <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-background focus-within:ring-2 focus-within:ring-ring">
                  {preferredPorts.map(port => (
                    <Badge key={port} variant="secondary" className="gap-1 pr-1">
                      {port}
                      <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removePort(port)} />
                    </Badge>
                  ))}
                  <input
                    className="flex-1 bg-transparent border-none outline-none text-sm min-w-[50px]"
                    placeholder={preferredPorts.length === 0 ? "Type port & press comma..." : ""}
                    value={portInput}
                    onChange={e => setPortInput(e.target.value)}
                    onKeyDown={handlePortKeyDown}
                  />
                </div>
                <p className="text-[0.8rem] text-muted-foreground">Press comma (,) or Enter to add a port.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Commands */}
        <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Commands</CardTitle>
            <CardDescription>Configure existing or add custom commands.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Existing/Default Commands List */}
            {commands.length > 0 && (
              <div className="space-y-3">
                {commands.map((cmd, idx) => (
                  <div key={idx} className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/30 relative group hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {cmd.name}
                          {cmd.description && <span className="text-xs font-normal text-muted-foreground">- {cmd.description}</span>}
                        </div>
                        <div className="text-xs font-mono bg-background px-2 py-1 rounded border overflow-x-auto max-w-[300px] md:max-w-md lg:max-w-lg">
                          {cmd.value}
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeCommand(idx)}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Add New Command */}
            <div className="grid gap-4 p-4 border rounded-lg bg-background/50">
              <h4 className="font-medium text-sm">Add Custom Command</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-xs">Command Name</Label>
                  <Input value={newCmdName} onChange={e => setNewCmdName(e.target.value.replace(/[^a-zA-Z0-9-]/g, '-'))} placeholder="e.g. migrate" className="h-9" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Description</Label>
                  <Input value={newCmdDesc} onChange={e => setNewCmdDesc(e.target.value)} placeholder="Optional description" className="h-9" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">Command Script</Label>
                <Textarea value={newCmdValue} onChange={e => setNewCmdValue(e.target.value)} placeholder="npm run migrate" className="font-mono text-sm min-h-[80px]" />
              </div>
              <Button type="button" onClick={addCustomCommand} variant="secondary" size="sm" className="w-full md:w-auto self-end">
                <Plus className="h-4 w-4 mr-2" /> Add Command
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4">
          <Button type="submit" size="lg" disabled={isLoading} className="w-full md:w-auto min-w-[200px]">
            {isLoading ? 'Deploying...' : 'Deploy Application'}
          </Button>
        </div>

      </form>
    </div>
  );
}
