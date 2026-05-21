"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/core/hooks/use-toast";
import { createServer, checkServerConnection } from "@/services/server/server-service";
import { serializeServerMetadata } from "@/services/server/server-metadata";
import { ServerFormFields, type ServerFormData } from "@/components/server/server-form-fields";

const initialState: ServerFormData = {
  name: "",
  username: "root",
  type: "Ubuntu 22.04",
  provider: "Custom",
  publicIp: "",
  privateIp: "",
  privateKey: "",
  publicKey: "",
  privateKeyPassphrase: "",
  expiresAt: "",
};

export default function AddServerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [formData, setFormData] = useState<ServerFormData>(initialState);

  const updateField = (name: keyof ServerFormData, value: string) => {
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleCheckConnection = async () => {
    if (!formData.publicIp || !formData.username || !formData.privateKey) {
      toast({
        variant: "destructive",
        title: "Missing required fields",
        description: "Please fill in Public IP, Username, and SSH private key.",
      });
      return;
    }

    setIsCheckingConnection(true);
    try {
      const tempServer = {
        id: `temp-${Date.now()}`,
        name: formData.name || "Test",
        username: formData.username,
        type: formData.type,
        provider: formData.provider,
        publicIp: formData.publicIp,
        privateIp: formData.privateIp || "",
        privateKey: formData.privateKey,
        moreDetails: serializeServerMetadata(undefined, {
          sshPassphrase: hasPasskey ? formData.privateKeyPassphrase || undefined : undefined,
        }),
      };

      const { runCommandOnServer } = await import("@/services/server/ssh");
      const { getServerSshPassphrase } = await import("@/services/server/server-metadata");
      const passphrase = getServerSshPassphrase(tempServer.moreDetails);

      const result = await runCommandOnServer(
        tempServer.publicIp,
        tempServer.username,
        tempServer.privateKey,
        'echo "Connection test successful"',
        undefined,
        undefined,
        false,
        {},
        passphrase ?? undefined
      );

      if (result.code === 0) {
        toast({ title: "Connection successful", description: "The server is reachable via SSH." });
      } else {
        toast({ variant: "destructive", title: "Connection failed", description: result.stderr || "Could not connect to the server." });
      }
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      await createServer({
        name: formData.name,
        username: formData.username,
        type: formData.type,
        provider: formData.provider,
        publicIp: formData.publicIp,
        privateIp: formData.privateIp,
        privateKey: formData.privateKey,
        publicKey: formData.publicKey,
        moreDetails: serializeServerMetadata(undefined, {
          validTill: formData.expiresAt || undefined,
          expiresAt: undefined,
          sshPassphrase: hasPasskey ? formData.privateKeyPassphrase || undefined : undefined,
        }),
      });

      toast({ title: "Server created", description: "The new server has been added." });
      router.push("/server/list");
    } catch {
      toast({ variant: "destructive", title: "Create failed", description: "We could not create the server." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-10">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Server management</p>
        <h1 className="text-4xl font-bold tracking-tight">Add server</h1>
        <p className="text-muted-foreground">Register a new server, store its SSH details, and optionally set an expiration date.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Server details</CardTitle>
            <CardDescription>Enter the connection details for the server you want to manage.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <ServerFormFields
              mode="add"
              formData={formData}
              onFieldChange={updateField}
              hasPasskey={hasPasskey}
              onHasPasskeyChange={setHasPasskey}
              showExpirationField
            />
          </CardContent>

          <CardFooter className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
            <Button variant="ghost" type="button" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="button" variant="outline" disabled={isLoading || isCheckingConnection} onClick={handleCheckConnection}>
              {isCheckingConnection ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                "Check connection"
              )}
            </Button>
            <Button type="submit" disabled={isLoading || isCheckingConnection}>
              {isLoading ? "Creating..." : "Create server"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
