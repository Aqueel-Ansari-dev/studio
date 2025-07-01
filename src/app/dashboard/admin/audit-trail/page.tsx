
'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ChevronDown, Activity, User, Briefcase, ClipboardList } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { fetchAuditLogs, type FetchAuditLogsResult } from '@/app/actions/admin/fetchAuditLogs';
import type { AuditLog } from '@/types/database';
import { formatDistanceToNow, format } from 'date-fns';

export default function AuditTrailPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [lastTimestamp, setLastTimestamp] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadLogs = useCallback(async (loadMore = false) => {
    if (loadMore && !hasMore) return;

    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const result: FetchAuditLogsResult = await fetchAuditLogs(25, loadMore ? lastTimestamp : undefined);
      if (result.success && result.logs) {
        setLogs(prev => loadMore ? [...prev, ...result.logs!] : result.logs!);
        setHasMore(result.hasMore || false);
        setLastTimestamp(result.lastVisibleTimestampISO ?? null);
      } else {
        toast({ title: 'Error', description: result.error || 'Could not load audit logs.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      if (loadMore) setIsLoadingMore(false);
      else setIsLoading(false);
    }
  }, [hasMore, lastTimestamp, toast]);

  useEffect(() => {
    if (!authLoading && user?.role === 'admin') {
      loadLogs();
    }
  }, [authLoading, user, loadLogs]);

  const getIconForType = (type: AuditLog['targetType']) => {
    switch (type) {
      case 'user': return <User className="h-4 w-4" />;
      case 'project': return <Briefcase className="h-4 w-4" />;
      case 'task': return <ClipboardList className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Review of significant actions taken within the system."
        actions={
          <Button onClick={() => loadLogs()} variant="outline" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading && !isLoadingMore ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">System Logs</CardTitle>
          <CardDescription>
            {isLoading && logs.length === 0 ? "Loading logs..." : `Showing ${logs.length} log entries.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">Loading audit trail...</p>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="w-[200px]">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.actorName || log.actorId}</TableCell>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground mt-0.5">{getIconForType(log.targetType)}</span>
                        <div>
                          <p>{log.details}</p>
                          <p className="text-xs text-muted-foreground">Type: <Badge variant="secondary" className="mr-2">{log.action}</Badge> Target ID: {log.targetId || 'N/A'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                        <div title={format(new Date(log.timestamp), 'PPpp')}>
                            {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                        </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {hasMore && (
              <div className="mt-6 text-center">
                <Button onClick={() => loadLogs(true)} disabled={isLoadingMore}>
                  {isLoadingMore ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <ChevronDown className="mr-2 h-4 w-4"/>}
                  Load More
                </Button>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
