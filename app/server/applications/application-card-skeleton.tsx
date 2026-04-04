
'use client';

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ApplicationCardSkeleton() {
  return (
    <div className="flex items-start gap-3 py-2">
      <Skeleton className="h-12 w-12 rounded-xl" />
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    </div>
  );
}
