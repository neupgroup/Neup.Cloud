// Moved from /app/(main)/server/applications/[id]/github-section.tsx
'use client';

import { performGitOperation } from "@/services/server/applications/service";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { useToast } from '@/core/hooks/useToast';
import { cn } from "@/core/utils";
import { Download, ExternalLink, GitBranch, GitPullRequest, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import Link from 'next/link';
import { useState } from "react";

interface GitHubSectionProps {
    application: any;
}

export function GitHubSection({ application }: GitHubSectionProps) {
    // ...existing code from github-section.tsx...
}
