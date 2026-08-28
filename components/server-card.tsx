// Moved from /app/(main)/servers/server-card.tsx
'use client';

import { ChevronRight, ServerIcon, Check, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "#/components/ui/button";
import { useToast } from '#/core/hooks/useToast';
import { shouldPreserveSelectedServer, withSelectedServerQuery } from "@/helpers/navigation";
import { deleteServer } from '@/services/server/server-service';
import type { Server } from '@/services/server/types';
import { cn } from "#/core/utils";

export type { Server } from '@/services/server/types';

type ServerCardProps = {
  server: Server;
  onServerDeleted: (id: string) => void;
  onServerSelected: (id: string) => void;
  isSelected: boolean;
  className?: string;
};

export function ServerCard({ server, onServerDeleted, onServerSelected, isSelected, className }: ServerCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isSwitching, setIsSwitching] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteServer(server.id);
      toast({
        title: "Server Deleted",
        description: "The server has been successfully deleted.",
      });
      onServerDeleted(server.id);
    } catch (error) {
      console.error("Error deleting document: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "There was a problem deleting the server.",
      });
    }
  };

  const handleSelect = async () => {
    if (isSelected || isSwitching) return;
    setIsSwitching(true);
    try {
      toast({
        name: 'cloud.server.selected',
        title: "Server Selected",
        description: `You are now managing \"${server.name}\".`,
        state: 'info',
        autoDismiss: 10,
      });
      onServerSelected(server.id);
      const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      if (shouldPreserveSelectedServer(pathname)) {
        router.replace(withSelectedServerQuery(currentUrl, server.id), { scroll: false });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "There was a problem selecting the server.",
      });
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors",
        isSelected ? "bg-primary/10 border-l-4 border-primary" : "",
        className
      )}
      onClick={handleSelect}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <ServerIcon className="h-6 w-6 text-primary" />
        <div className="min-w-0">
          <div className="font-semibold truncate">{server.name}</div>
          <div className="text-xs text-muted-foreground truncate">{server.publicIp}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isSelected ? (
          <Check className="h-5 w-5 text-primary" />
        ) : isSwitching ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : null}
        <Button variant="ghost" size="icon" onClick={handleDelete}>
          <span className="sr-only">Delete</span>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
