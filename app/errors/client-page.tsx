
'use client';

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { getErrors } from './actions';
import { useToast } from '../../hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

type AppError = {
  id: string;
  message: string;
  level: 'ERROR' | 'WARNING' | 'INFO';
  source: string;
  timestamp: {
    seconds: number;
    nanoseconds: number;
  } | string;
  stack?: string;
};

export default function ErrorsPage() {
  const { toast } = useToast();
  const [errors, setErrors] = useState<AppError[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchErrors = async () => {
    setIsLoading(true);
    try {
      const errorsData = await getErrors() as AppError[];
      setErrors(errorsData);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error fetching errors",
        description: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, []);

  const getBadgeInfo = (
    level: string
  ): {
    variant: 'default' | 'destructive' | 'outline' | 'secondary' | null;
    className: string;
    icon: React.ReactNode;
  } => {
    switch (level) {
      case 'ERROR':
        return {
          variant: 'destructive',
          className: '',
          icon: <ShieldAlert className="h-4 w-4" />,
        };
      case 'WARNING':
        return {
          variant: 'default',
          className: 'bg-yellow-500/20 text-yellow-700 border-yellow-400 hover:bg-yellow-500/30',
          icon: <AlertTriangle className="h-4 w-4" />,
        };
      default:
        return {
          variant: 'secondary',
          className: '',
          icon: <Info className="h-4 w-4" />,
        };
    }
  };

  const formatTimestamp = (timestamp: AppError['timestamp']) => {
    if (!timestamp) return 'N/A';
    if (typeof timestamp === 'string') {
        return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    }
    if (timestamp.seconds) {
        return formatDistanceToNow(new Date(timestamp.seconds * 1000), { addSuffix: true });
    }
    return 'Invalid date';
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" />
            Application Errors
        </CardTitle>
        <CardDescription>
          A log of all errors recorded within the application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Level</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">Loading errors...</TableCell>
              </TableRow>
            ) : errors && errors.length > 0 ? (
              errors.map((error) => {
                const badgeInfo = getBadgeInfo(error.level);
                return (
                  <TableRow key={error.id}>
                    <TableCell>
                      <Badge variant={badgeInfo.variant} className={badgeInfo.className}>
                          <span className="flex items-center gap-2">
                            {badgeInfo.icon}
                            {error.level}
                          </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{error.message}</TableCell>
                    <TableCell>{error.source}</TableCell>
                    <TableCell>{formatTimestamp(error.timestamp)}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center">No errors recorded.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
