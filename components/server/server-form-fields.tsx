"use client";

import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/core/hooks/use-toast";
import { generateSshKeyPair } from "@/services/server/server-service";

export type ServerFormData = {
  name: string;
  username: string;
  type: string;
  provider: string;
  publicIp: string;
  privateIp: string;
  privateKey: string;
  publicKey: string;
  privateKeyPassphrase: string;
  expiresAt?: string;
};

type Props = {
  mode: "add" | "edit";
  formData: ServerFormData;
  onFieldChange: (name: keyof ServerFormData, value: string) => void;
  hasPasskey: boolean;
  onHasPasskeyChange: (value: boolean) => void;
  showExpirationField?: boolean;
};

export function ServerFormFields({
  mode,
  formData,
  onFieldChange,
  hasPasskey,
  onHasPasskeyChange,
  showExpirationField = false,
}: Props) {
  const { toast } = useToast();
  const [isPrivateKeyDragActive, setIsPrivateKeyDragActive] = useState(false);
  const [isGenerateFlow, setIsGenerateFlow] = useState(false);
  const [generatorName, setGeneratorName] = useState("");
  const [generatorAlgo, setGeneratorAlgo] = useState<"ed25519" | "rsa" | "ecdsa">("ed25519");
  const [generatorPassphrase, setGeneratorPassphrase] = useState("");
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
  const [generatedBundle, setGeneratedBundle] = useState<{ privateKey: string; publicKey: string } | null>(null);
  const [hasGeneratedKeys, setHasGeneratedKeys] = useState(false);
  const privateKeyFileInputRef = useRef<HTMLInputElement | null>(null);

  const canGenerate = useMemo(() => generatorName.trim().length > 0, [generatorName]);

  const importPrivateKeyFile = async (file: File) => {
    try {
      if (file.size > 512_000) {
        toast({ variant: "destructive", title: "File too large", description: "Please select a smaller private key file." });
        return;
      }

      const text = (await file.text()).trim();
      if (!text) {
        toast({ variant: "destructive", title: "Empty file", description: "The selected file does not contain an SSH private key." });
        return;
      }

      let importedPrivateKey = text;
      let importedPublicKey = "";
      let importedPassphrase = "";

      if (text.startsWith("{")) {
        try {
          const parsed = JSON.parse(text) as { private?: string; public?: string; passphrase?: string };
          if (parsed.private?.trim()) {
            importedPrivateKey = parsed.private.trim();
            importedPublicKey = parsed.public?.trim() ?? "";
            importedPassphrase = parsed.passphrase?.trim() ?? "";
          }
        } catch {
          // Use raw text fallback.
        }
      }

      if (!importedPrivateKey) {
        toast({ variant: "destructive", title: "Invalid key file", description: "Could not find a valid private key in this file." });
        return;
      }

      onFieldChange("privateKey", importedPrivateKey);
      if (importedPublicKey) onFieldChange("publicKey", importedPublicKey);
      if (importedPassphrase) {
        onFieldChange("privateKeyPassphrase", importedPassphrase);
        onHasPasskeyChange(true);
      }

      toast({ title: "SSH key imported", description: `Loaded ${file.name}` });
    } catch {
      toast({ variant: "destructive", title: "Import failed", description: "We could not read the selected key file." });
    }
  };

  const handlePrivateKeyFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await importPrivateKeyFile(file);
  };

  const handleGenerateKeys = async () => {
    if (!canGenerate) return;

    setIsGeneratingKeys(true);
    try {
      const generated = await generateSshKeyPair({
        name: generatorName.trim(),
        algorithm: generatorAlgo,
        passphrase: generatorPassphrase,
      });

      setGeneratedBundle(generated);
      onFieldChange("privateKey", generated.privateKey);
      onFieldChange("publicKey", generated.publicKey);
      onFieldChange("privateKeyPassphrase", generatorPassphrase);
      onHasPasskeyChange(Boolean(generatorPassphrase));
      setHasGeneratedKeys(true);
      setIsGenerateFlow(false);

      toast({ title: "SSH keys generated", description: "Fields have been filled with generated key data." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to generate keys",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  const handleDownloadGeneratedKeys = () => {
    if (!generatedBundle) return;

    const payload: Record<string, string> = {
      name: generatorName.trim() || "ssh-key",
      public: generatedBundle.publicKey,
      private: generatedBundle.privateKey,
    };

    if (generatorPassphrase) payload.passphrase = generatorPassphrase;

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${payload.name}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="name">Server name</Label>
        <Input id="name" required value={formData.name} onChange={(event) => onFieldChange("name", event.target.value)} placeholder="production-01" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="publicIp">Public IP</Label>
          <Input id="publicIp" required value={formData.publicIp} onChange={(event) => onFieldChange("publicIp", event.target.value)} placeholder="1.2.3.4" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="privateIp">Private IP</Label>
          <Input id="privateIp" value={formData.privateIp} onChange={(event) => onFieldChange("privateIp", event.target.value)} placeholder="10.0.0.10" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" required value={formData.username} onChange={(event) => onFieldChange("username", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="provider">Provider</Label>
          <Select value={formData.provider} onValueChange={(value) => onFieldChange("provider", value)}>
            <SelectTrigger id="provider">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Custom">Custom / Other</SelectItem>
              <SelectItem value="DigitalOcean">DigitalOcean</SelectItem>
              <SelectItem value="AWS">AWS</SelectItem>
              <SelectItem value="Hetzner">Hetzner</SelectItem>
              <SelectItem value="Vultr">Vultr</SelectItem>
              <SelectItem value="Linode">Linode</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="type">OS / type</Label>
        <Input id="type" required value={formData.type} onChange={(event) => onFieldChange("type", event.target.value)} placeholder="Ubuntu 22.04" />
      </div>

      {showExpirationField ? (
        <div className="grid gap-2">
          <Label htmlFor="expiresAt">Expiration</Label>
          <Input id="expiresAt" type="datetime-local" value={formData.expiresAt ?? ""} onChange={(event) => onFieldChange("expiresAt", event.target.value)} />
          <p className="text-xs text-muted-foreground">Leave this blank if the server should stay active indefinitely.</p>
        </div>
      ) : null}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>SSH private key</CardTitle>
          <CardDescription>Import an SSH key file or generate a new one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={privateKeyFileInputRef}
              type="file"
              accept=".pem,.key,.txt,.json,application/json,text/plain"
              className="hidden"
              onChange={handlePrivateKeyFileSelected}
            />
            <Button type="button" variant="outline" onClick={() => privateKeyFileInputRef.current?.click()}>
              Import key file
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsGenerateFlow(true)}>
              Generate key
            </Button>
          </div>

          {isGenerateFlow ? (
            <div className="rounded-md border bg-muted/20 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Generate SSH key</p>
                <p className="text-xs text-muted-foreground">Provide a key name, type, and optional passphrase.</p>
              </div>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="generatorName">Name</Label>
                  <Input id="generatorName" value={generatorName} onChange={(event) => setGeneratorName(event.target.value)} placeholder="mail-key" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="generatorAlgo">Key type</Label>
                  <Select value={generatorAlgo} onValueChange={(value: "ed25519" | "rsa" | "ecdsa") => setGeneratorAlgo(value)}>
                    <SelectTrigger id="generatorAlgo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ed25519">Ed25519</SelectItem>
                      <SelectItem value="rsa">RSA 4096</SelectItem>
                      <SelectItem value="ecdsa">ECDSA 521</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="generatorPassphrase">Passphrase</Label>
                  <Input
                    id="generatorPassphrase"
                    type="password"
                    value={generatorPassphrase}
                    onChange={(event) => setGeneratorPassphrase(event.target.value)}
                    placeholder="Keep this empty to not have a passphrase"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsGenerateFlow(false)}>
                  Cancel
                </Button>
                <Button type="button" disabled={!canGenerate || isGeneratingKeys} onClick={handleGenerateKeys}>
                  {isGeneratingKeys ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Generate
                </Button>
              </div>
            </div>
          ) : null}

          {!isGenerateFlow ? (
            <>
              <Textarea
                id="privateKey"
                required={mode === "add"}
                value={formData.privateKey}
                onChange={(event) => onFieldChange("privateKey", event.target.value)}
                onDragEnter={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsPrivateKeyDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsPrivateKeyDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsPrivateKeyDragActive(false);
                }}
                onDrop={async (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsPrivateKeyDragActive(false);
                  const file = event.dataTransfer.files?.[0];
                  if (!file) return;
                  await importPrivateKeyFile(file);
                }}
                placeholder={mode === "add" ? "-----BEGIN OPENSSH PRIVATE KEY-----" : "Leave blank to keep the existing key"}
                className={`min-h-40 font-mono text-xs ${isPrivateKeyDragActive ? "ring-2 ring-primary ring-offset-2" : ""}`}
              />

              {mode === "edit" ? (
                <p className="text-xs text-muted-foreground">Only enter a new private key if you want to replace the existing one.</p>
              ) : null}

              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input type="checkbox" checked={hasPasskey} onChange={(event) => onHasPasskeyChange(event.target.checked)} />
                Has passkey?
              </label>

              {hasPasskey ? (
                <div className="grid gap-2">
                  <Label htmlFor="privateKeyPassphrase">Passphrase</Label>
                  <Input
                    id="privateKeyPassphrase"
                    type="password"
                    value={formData.privateKeyPassphrase}
                    onChange={(event) => onFieldChange("privateKeyPassphrase", event.target.value)}
                    placeholder="Enter passphrase"
                  />
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="publicKey">Public key</Label>
                <Textarea
                  id="publicKey"
                  value={formData.publicKey}
                  onChange={(event) => onFieldChange("publicKey", event.target.value)}
                  placeholder="ssh-ed25519 AAAA..."
                  className="min-h-24 font-mono text-xs"
                />
              </div>

              {hasGeneratedKeys ? (
                <div className="flex justify-start">
                  <Button type="button" variant="outline" onClick={handleDownloadGeneratedKeys}>
                    Download key data
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
