"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock3, Loader2, ServerIcon, ShieldAlert, ShieldCheck } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/core/hooks/use-toast";
import { getServer, updateServer, checkServerConnection } from "@/services/server/server-service";
import type { Server } from "@/services/server/types";
import { getServerExpiration, getServerSshPassphrase, parseServerMetadata, serializeServerMetadata } from "@/services/server/server-metadata";
import { ServerFormFields, type ServerFormData } from "@/components/server/server-form-fields";

function formatDate(value?: string | null) {
  if (!value) return "No expiration set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid expiration";

  return date.toLocaleString();
}

function isExpired(value?: string | null) {
  if (!value) return false;

  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

function addExpirationMonths(baseValue: string | null | undefined, months: number) {
  const baseDate = baseValue ? new Date(baseValue) : new Date();
  if (Number.isNaN(baseDate.getTime())) return new Date();

  const nextDate = new Date(baseDate);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

export default function ServerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  const { id: serverId } = use(params);
  const [server, setServer] = useState<Server | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadServer = async () => {
      setIsLoading(true);
      try {
        const data = await getServer(serverId);
        if (!cancelled) setServer(data);
      } catch {
        if (!cancelled) {
          toast({ variant: "destructive", title: "Could not load server", description: "Please try again." });
          setServer(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadServer();
    return () => {
      cancelled = true;
    };
  }, [serverId, toast]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-10">
        <Button variant="ghost" className="w-fit px-0 text-muted-foreground hover:text-foreground" onClick={() => router.push("/server/list")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to servers
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Loading server</CardTitle>
            <CardDescription>Fetching the latest connection details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-10">
        <Button variant="ghost" className="w-fit px-0 text-muted-foreground hover:text-foreground" onClick={() => router.push("/server/list")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to servers
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Server not found</CardTitle>
            <CardDescription>The server may have been removed or the link is outdated.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <ServerDetailsForm server={server} />;
}

function ServerDetailsForm({ server }: { server: Server }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isExpiring, setIsExpiring] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [serverState, setServerState] = useState(server);

  const currentExpiration = getServerExpiration(serverState.moreDetails);
  const currentMetadata = useMemo(() => parseServerMetadata(serverState.moreDetails), [serverState.moreDetails]);
  const currentPassphrase = useMemo(() => getServerSshPassphrase(serverState.moreDetails) ?? "", [serverState.moreDetails]);

  const [hasPasskey, setHasPasskey] = useState(Boolean(currentPassphrase));
  const [formData, setFormData] = useState<ServerFormData>({
    name: serverState.name,
    username: serverState.username,
    type: serverState.type,
    provider: serverState.provider,
    publicIp: serverState.publicIp,
    privateIp: serverState.privateIp ?? "",
    privateKey: "",
    publicKey: serverState.publicKey ?? "",
    privateKeyPassphrase: "",
  });

  useEffect(() => {
    setFormData({
      name: serverState.name,
      username: serverState.username,
      type: serverState.type,
      provider: serverState.provider,
      publicIp: serverState.publicIp,
      privateIp: serverState.privateIp ?? "",
      privateKey: "",
      publicKey: serverState.publicKey ?? "",
      privateKeyPassphrase: "",
    });
    setHasPasskey(Boolean(currentPassphrase));
  }, [currentExpiration, serverState, currentPassphrase]);

  const updateField = (name: keyof ServerFormData, value: string) => {
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await updateServer(serverState.id, {
        name: formData.name,
        username: formData.username,
        type: formData.type,
        provider: formData.provider,
        publicIp: formData.publicIp,
        privateIp: formData.privateIp,
        privateKey: formData.privateKey,
        publicKey: formData.publicKey,
        moreDetails: serializeServerMetadata(serverState.moreDetails, {
          ...currentMetadata,
          sshPassphrase: hasPasskey ? formData.privateKeyPassphrase || currentPassphrase || undefined : undefined,
        }),
      });

      const refreshedServer = await getServer(serverState.id);
      if (refreshedServer) setServerState(refreshedServer);

      toast({ title: "Server updated", description: "The server details were saved." });
    } catch {
      toast({ variant: "destructive", title: "Update failed", description: "We could not save the server changes." });
    } finally {
      setIsSaving(false);
    }
  };

  const updateExpiration = async (nextExpiration: Date | null) => {
    setIsExpiring(true);
    try {
      await updateServer(serverState.id, {
        moreDetails: serializeServerMetadata(serverState.moreDetails, {
          ...currentMetadata,
          validTill: nextExpiration ? nextExpiration.toISOString() : undefined,
          expiresAt: undefined,
          sshPassphrase: currentPassphrase || undefined,
        }),
      });

      const refreshedServer = await getServer(serverState.id);
      if (refreshedServer) setServerState(refreshedServer);

      toast({
        title: nextExpiration ? "Expiration updated" : "Server expired",
        description: nextExpiration ? "The server expiration was extended." : "The server has been marked as expired.",
      });
    } catch {
      toast({ variant: "destructive", title: "Expiration update failed", description: "We could not update the server expiration." });
    } finally {
      setIsExpiring(false);
    }
  };

  const handleCheckConnection = async () => {
    setIsCheckingConnection(true);
    try {
      const result = await checkServerConnection(serverState.id);
      toast({
        title: result.success ? "Connection successful" : "Connection failed",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Connection check failed",
        description: error instanceof Error ? error.message : "Unable to check connection.",
      });
    } finally {
      setIsCheckingConnection(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-10">
      <Button variant="ghost" className="w-fit px-0 text-muted-foreground hover:text-foreground" onClick={() => router.push("/server/list")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to servers
      </Button>

      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Server details</p>
        <h1 className="text-4xl font-bold tracking-tight">{serverState.name}</h1>
        <p className="text-muted-foreground">{serverState.username}@{serverState.publicIp} · {serverState.provider}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <ServerIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Provider</p>
              <p className="font-medium">{server.provider}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock3 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium">{isExpired(currentExpiration) ? "Expired" : "Active"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-colors hover:bg-accent" onClick={handleCheckConnection}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Connection</p>
                <p className="text-sm font-medium">Check SSH access</p>
              </div>
            </div>
            {isCheckingConnection && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expiration</CardTitle>
          <CardDescription>Extend the current expiration or expire the server immediately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => updateExpiration(addExpirationMonths(currentExpiration, 1))} disabled={isExpiring}>Add 1 month</Button>
            <Button type="button" variant="outline" onClick={() => updateExpiration(addExpirationMonths(currentExpiration, 3))} disabled={isExpiring}>Add 3 months</Button>
            <Button type="button" variant="outline" onClick={() => updateExpiration(addExpirationMonths(currentExpiration, 6))} disabled={isExpiring}>Add 6 months</Button>
            <Button type="button" variant="outline" onClick={() => updateExpiration(addExpirationMonths(currentExpiration, 12))} disabled={isExpiring}>Add 1 year</Button>
          </div>
          <p className="text-sm text-muted-foreground">Current expiration: <span className="font-medium text-foreground">{formatDate(currentExpiration)}</span></p>
        </CardContent>
        <CardFooter className="justify-end border-t px-6 py-4">
          <ConfirmDialog
            trigger={<Button type="button" variant="destructive" disabled={isExpiring}><ShieldAlert className="mr-2 h-4 w-4" />Expire</Button>}
            title="Expire this server?"
            description="This will set the server expiration to now."
            confirmLabel={isExpiring ? "Updating..." : "Expire"}
            onConfirm={() => updateExpiration(new Date())}
            loading={isExpiring}
          />
        </CardFooter>
      </Card>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Edit server</CardTitle>
            <CardDescription>Update the SSH connection details or change when the server expires.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ServerFormFields
              mode="edit"
              formData={formData}
              onFieldChange={updateField}
              hasPasskey={hasPasskey}
              onHasPasskeyChange={setHasPasskey}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-2 border-t px-6 py-4 sm:flex-row sm:justify-between">
            <ConfirmDialog
              trigger={<Button type="button" variant="destructive" className="w-full sm:w-auto"><ShieldAlert className="mr-2 h-4 w-4" />Expire now</Button>}
              title="Expire this server?"
              description="This will mark the server as expired in its metadata. You can move the expiration date later by editing the server."
              confirmLabel={isExpiring ? "Expiring..." : "Expire now"}
              onConfirm={() => updateExpiration(new Date())}
              loading={isExpiring}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="ghost" onClick={() => router.push("/server/list")}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save changes</Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
