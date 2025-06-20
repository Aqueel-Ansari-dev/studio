"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Download,
  Trash2,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import {
  fetchInvoicesForAdmin,
  type InvoiceForAdminList,
} from "@/app/actions/admin/invoicing/fetchInvoicesForAdmin";
import { deleteInvoice } from "@/app/actions/admin/invoicing/deleteInvoice";
import { useToast } from "@/hooks/use-toast";

export default function InvoiceListPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceForAdminList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastCreatedAt, setLastCreatedAt] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const INVOICES_PER_PAGE = 15;

  const loadInvoices = async (loadMore = false) => {
    if (!loadMore) {
      setIsLoading(true);
      setInvoices([]);
      setLastCreatedAt(null);
      setHasMore(true);
    } else {
      if (!hasMore) return;
      setIsLoadingMore(true);
    }

    const result = await fetchInvoicesForAdmin(
      INVOICES_PER_PAGE,
      loadMore ? lastCreatedAt : undefined
    );

    if (result.success && result.invoices) {
      setInvoices(prev =>
        loadMore ? [...prev, ...result.invoices!] : result.invoices!
      );
      setLastCreatedAt(result.lastVisibleCreatedAtISO ?? null);
      setHasMore(result.hasMore ?? false);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to load invoices',
        variant: 'destructive',
      });
      if (!loadMore) setInvoices([]);
      setHasMore(false);
    }

    if (!loadMore) setIsLoading(false);
    else setIsLoadingMore(false);
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    const res = await deleteInvoice(deletingId);
    if (res.success) {
      setInvoices(prev => prev.filter(inv => inv.id !== deletingId));
      toast({ title: 'Deleted', description: 'Invoice removed' });
    } else {
      toast({ title: 'Error', description: res.message, variant: 'destructive' });
    }
    setIsDeleting(false);
    setShowConfirm(false);
    setDeletingId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="View invoices"
        actions={
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/dashboard/admin/invoices/new">New Invoice</Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p>Loading...</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link href={`/dashboard/admin/invoices/${inv.id}`}>{inv.invoiceNumber}</Link>
                      </TableCell>
                      <TableCell>{inv.projectName}</TableCell>
                      <TableCell>{inv.clientName}</TableCell>
                      <TableCell>
                        {typeof inv.total === 'number' ? inv.total.toFixed(2) : inv.total ?? '-'}
                      </TableCell>
                      <TableCell>{inv.status}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          title="Download Invoice"
                        >
                          <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                            <span className="sr-only">Download</span>
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete Invoice"
                          onClick={() => {
                            setDeletingId(inv.id);
                            setShowConfirm(true);
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {hasMore && (
                <div className="mt-6 text-center">
                  <Button onClick={() => loadInvoices(true)} disabled={isLoadingMore}>
                    {isLoadingMore ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronDown className="mr-2 h-4 w-4" />
                    )}
                    Load More Invoices
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {deletingId && (
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the invoice.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowConfirm(false)} disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
