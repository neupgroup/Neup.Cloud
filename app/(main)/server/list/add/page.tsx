"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "#/components/ui/card";
import { useToast } from "#/core/hooks/useToast";
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
  authMethod: "privateKey",
  privateKey: "",
  publicKey: "",
  privateKeyPassphrase: "",
  sshPassword: "",
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
    const usesPrivateKey = formData.authMethod === "privateKey";
    const privateKey = formData.privateKey.trim();
    const sshPassword = formData.sshPassword.trim();

    if (!formData.publicIp || !formData.username || (usesPrivateKey ? !privateKey : !sshPassword)) {
      toast({
        variant: "destructive",
        title: "Missing required fields",
        description: usesPrivateKey
          ? "Please fill in Public IP, Username, and SSH private key."
          : "Please fill in Public IP, Username, and password.",
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
        privateKey: usesPrivateKey ? privateKey : "",
        moreDetails: serializeServerMetadata(undefined, {
          sshAuthMethod: usesPrivateKey ? "privateKey" : "password",
          sshPassphrase: usesPrivateKey && hasPasskey ? formData.privateKeyPassphrase || undefined : undefined,
          sshPassword: usesPrivateKey ? undefined : sshPassword,
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
        passphrase ?? undefined,
        undefined,
        usesPrivateKey ? undefined : sshPassword
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
      const usesPrivateKey = formData.authMethod === "privateKey";

      await createServer({
        name: formData.name,
        username: formData.username,
        type: formData.type,
        provider: formData.provider,
        publicIp: formData.publicIp,
        privateIp: formData.privateIp,
        privateKey: usesPrivateKey ? formData.privateKey.trim() : null,
        publicKey: usesPrivateKey ? formData.publicKey : null,
        moreDetails: serializeServerMetadata(undefined, {
          validTill: formData.expiresAt || undefined,
          expiresAt: undefined,
          sshAuthMethod: usesPrivateKey ? "privateKey" : "password",
          sshPassphrase: usesPrivateKey && hasPasskey ? formData.privateKeyPassphrase || undefined : undefined,
          sshPassword: usesPrivateKey ? undefined : formData.sshPassword.trim(),
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
            <Button type="plain" htmlType="button" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button htmlType="button" type="outlined" disabled={isLoading || isCheckingConnection} onClick={handleCheckConnection}>
              {isCheckingConnection ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                "Check connection"
              )}
            </Button>
            <Button htmlType="submit" disabled={isLoading || isCheckingConnection}>
              {isLoading ? "Creating..." : "Create server"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
