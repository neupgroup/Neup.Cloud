'use client';

import { useState } from 'react';
import { Copy, KeyRound, Loader2, WandSparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/core/hooks/use-toast';
import { generateSshKeyPair } from '@/services/server/server-service';

type SshKeypairGeneratorProps = {
  onUsePrivateKey: (value: string) => void;
};

export function SshKeypairGenerator({ onUsePrivateKey }: SshKeypairGeneratorProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [publicKey, setPublicKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [keyName, setKeyName] = useState('');
  const [algorithm, setAlgorithm] = useState<'ed25519' | 'rsa' | 'ecdsa'>('ed25519');
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState('');

  const copyToClipboard = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied` });
    } catch {
      toast({
        title: `Could not copy ${label.toLowerCase()}`,
        variant: 'destructive',
      });
    }
  };

  const handleGenerate = async () => {
    const trimmedName = keyName.trim();
    if (!trimmedName) {
      toast({
        title: 'Name is required',
        description: 'Please provide a key name before generating.',
        variant: 'destructive',
      });
      return;
    }

    if (usePassphrase && !passphrase) {
      toast({
        title: 'Passphrase is required',
        description: 'Please provide a passphrase or turn off passphrase protection.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const generated = await generateSshKeyPair({
        name: trimmedName,
        algorithm,
        passphrase: usePassphrase ? passphrase : '',
      });
      setPrivateKey(generated.privateKey);
      setPublicKey(generated.publicKey);
      onUsePrivateKey(generated.privateKey);
      toast({
        title: 'SSH key pair generated',
        description: 'Public key is ready to copy and paste.',
      });
    } catch (error) {
      toast({
        title: 'Failed to generate key pair',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = keyName.trim().length > 0 && (!usePassphrase || passphrase.length > 0);

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Generate SSH key pair</p>
        <p className="text-xs text-muted-foreground">Provide key details first, then generate a fresh private/public key pair.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ssh-key-name" className="text-xs">Name</Label>
          <Input
            id="ssh-key-name"
            value={keyName}
            onChange={(event) => setKeyName(event.target.value)}
            placeholder="mail-server-key"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ssh-key-algorithm" className="text-xs">Key type</Label>
          <Select value={algorithm} onValueChange={(value: 'ed25519' | 'rsa' | 'ecdsa') => setAlgorithm(value)}>
            <SelectTrigger id="ssh-key-algorithm">
              <SelectValue placeholder="Select key type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ed25519">Ed25519 (recommended)</SelectItem>
              <SelectItem value="rsa">RSA 4096</SelectItem>
              <SelectItem value="ecdsa">ECDSA 521</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Use passphrase</Label>
          <div className="flex h-10 items-center rounded-md border bg-background px-3">
            <Switch checked={usePassphrase} onCheckedChange={setUsePassphrase} />
            <span className="ml-3 text-sm text-muted-foreground">
              {usePassphrase ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        {usePassphrase ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ssh-key-passphrase" className="text-xs">Passphrase</Label>
            <Input
              id="ssh-key-passphrase"
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Enter passphrase"
            />
          </div>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={handleGenerate} disabled={isGenerating || !canGenerate}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
          Generate
        </Button>
      </div>

      {publicKey ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="generatedPublicKey" className="text-xs">Public key (copy this where needed)</Label>
            <Button type="button" size="sm" variant="ghost" onClick={() => copyToClipboard(publicKey, 'Public key')}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy public key
            </Button>
          </div>
          <Textarea
            id="generatedPublicKey"
            value={publicKey}
            readOnly
            className="min-h-20 font-mono text-xs"
          />
        </div>
      ) : null}

      {privateKey ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="ghost" onClick={() => copyToClipboard(privateKey, 'Private key')}>
            <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Copy private key
          </Button>
        </div>
      ) : null}
    </div>
  );
}
