// Moved from /app/(main)/server/applications/[id]/status-dashboard.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/component/ui/card";
import { AppStatusResult, checkApplicationStatus } from "@/services/server/applications/status-actions";
import { AlertCircle, Clock, Loader2, PlayCircle, StopCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/core/utils";
import { Button } from "@/component/ui/button";

interface StatusDashboardProps {
    applicationId: string;
}

export function StatusDashboard({ applicationId }: StatusDashboardProps) {
    // ...existing code from status-dashboard.tsx...
}
