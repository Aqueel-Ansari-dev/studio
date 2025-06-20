"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createInvoiceDraft } from "@/app/actions/admin/invoicing/createInvoiceDraft";
import { format, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchAllProjects, type ProjectForSelection } from "@/app/actions/common/fetchAllProjects";
import { fetchAllUsersBasic, type UserBasic } from "@/app/actions/common/fetchAllUsersBasic";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export default function NewInvoicePage() {
  const { toast } = useToast();
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [clients, setClients] = useState<UserBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 15), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0, taxRate: 0 }]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const projRes = await fetchAllProjects();
      if (projRes.success && projRes.projects) setProjects(projRes.projects);
      const userRes = await fetchAllUsersBasic();
      if (userRes.success && userRes.users) setClients(userRes.users);
      setLoading(false);
    }
    load();
  }, []);

  const addItem = () => setItems([...items, { description: "", quantity: 1, unitPrice: 0, taxRate: 0 }]);
  const updateItem = (idx: number, field: keyof LineItem, value: string) => {
    const updated = [...items];
    if (field === "description") {
      updated[idx].description = value;
    } else {
      updated[idx][field] = parseFloat(value) || 0;
    }
    setItems(updated);
  };
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice * i.taxRate, 0);
  const total = subtotal + taxTotal;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await createInvoiceDraft({ projectId, clientId, items, invoiceDate, dueDate, notes });
    if (result.success) {
      toast({ title: "Invoice Draft Created", description: result.invoiceId });
      setProjectId("");
      setClientId("");
      setNotes("");
      setItems([{ description: "", quantity: 1, unitPrice: 0, taxRate: 0 }]);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Invoice" description="Create a client invoice" />
      <Card>
        <CardHeader>
          <CardTitle>Invoice Builder</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder={loading ? 'Loading projects...' : 'Select project'} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder={loading ? 'Loading clients...' : 'Select client'} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Invoice Date</Label>
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-24">Qty</TableHead>
                    <TableHead className="w-32">Unit Price</TableHead>
                    <TableHead className="w-24">Tax %</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Input value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={item.taxRate} onChange={(e) => updateItem(idx, "taxRate", e.target.value)} />
                      </TableCell>
                      <TableCell>{(item.quantity * item.unitPrice * (1 + item.taxRate)).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" onClick={() => removeItem(idx)}>-</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button type="button" variant="outline" onClick={addItem}>Add Item</Button>
            <div className="text-right space-y-1">
              <p>Subtotal: {subtotal.toFixed(2)}</p>
              <p>Tax: {taxTotal.toFixed(2)}</p>
              <p className="font-bold">Total: {total.toFixed(2)}</p>
            </div>
            <Button type="submit" disabled={submitting} className="bg-accent hover:bg-accent/90">
              {submitting ? "Saving..." : "Save Draft"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
