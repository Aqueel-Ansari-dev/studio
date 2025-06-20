"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Invoice } from "@/types/database";

export default function InvoiceListPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  useEffect(() => {
    async function load() {
      const q = query(collection(db, "invoices"));
      const snap = await getDocs(q);
      const data: Invoice[] = [];
      snap.forEach((doc) => data.push({ id: doc.id, ...(doc.data() as any) }));
      setInvoices(data);
    }
    load();
  }, []);

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link href={`/dashboard/admin/invoices/${inv.id}`}>{inv.invoiceNumber}</Link>
                  </TableCell>
                  <TableCell>{inv.projectId}</TableCell>
                  <TableCell>{inv.clientId}</TableCell>
                  <TableCell>
                    {typeof inv.total === 'number'
                      ? inv.total.toFixed(2)
                      : inv.total ?? '-'}
                  </TableCell>
                  <TableCell>{inv.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
