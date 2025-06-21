
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { createInvoiceDraft } from "@/app/actions/admin/invoicing/createInvoiceDraft";
import { format, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchAllProjects, type ProjectForSelection } from "@/app/actions/common/fetchAllProjects";
import { ArrowLeft, PlusCircle, Edit, Trash2 } from "lucide-react";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

const defaultItem: LineItem = { description: "", quantity: 1, unitPrice: 0, taxRate: 0 };

export default function NewInvoicePage() {
  const { toast } = useToast();
  const router = useRouter();

  // Main invoice fields
  const [projectId, setProjectId] = useState("");
  const [clientName, setClientName] = useState("");
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 15), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Line item management state
  const [items, setItems] = useState<LineItem[]>([]);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<(LineItem & { index?: number }) | null>(null);

  useEffect(() => {
    async function load() {
      const projRes = await fetchAllProjects();
      if (projRes.success && projRes.projects) setProjects(projRes.projects);
      setLoading(false);
    }
    load();
  }, []);

  const handleOpenItemDialog = (item?: LineItem, index?: number) => {
    setCurrentItem(item ? { ...item, index } : { ...defaultItem });
    setIsItemDialogOpen(true);
  };

  const handleSaveItem = () => {
    if (!currentItem) return;
    const { index, ...itemData } = currentItem;
    if (typeof index === 'number') {
      // Editing existing item
      const updatedItems = [...items];
      updatedItems[index] = itemData;
      setItems(updatedItems);
    } else {
      // Adding new item
      setItems([...items, itemData]);
    }
    setIsItemDialogOpen(false);
    setCurrentItem(null);
  };
  
  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };
  
  const { subtotal, taxTotal, total } = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const taxTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.taxRate / 100), 0);
    const total = subtotal + taxTotal;
    return { subtotal, taxTotal, total };
  }, [items]);


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      toast({ title: "Error", description: "Please add at least one line item.", variant: "destructive"});
      return;
    }
    setSubmitting(true);
    const result = await createInvoiceDraft({ projectId, clientName, items, invoiceDate, dueDate, notes });
    if (result.success) {
      toast({ title: "Invoice Draft Created", description: `Invoice ID: ${result.invoiceId}` });
      router.push(`/dashboard/admin/invoices/${result.invoiceId}`);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setSubmitting(false);
  }

  const pageActions = (
    <Button onClick={() => router.push('/dashboard/admin/invoices')} variant="outline">
      <ArrowLeft className="mr-2 h-4 w-4" /> Back to Invoices
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="New Invoice" description="Create a client invoice" actions={pageActions} />
      <Card>
        <CardHeader>
          <CardTitle>Invoice Builder</CardTitle>
          <CardDescription>Fill in the client and project details, then add line items.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <Label>Client Name</Label>
                <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Client name" />
              </div>
              <div>
                <Label>Invoice Date</Label>
                <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-lg font-medium">Line Items</Label>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-center">Unit Price</TableHead>
                      <TableHead className="text-center">Tax %</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                          No items added yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-center">{item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-center">{item.taxRate}</TableCell>
                        <TableCell className="text-right">
                          {(item.quantity * item.unitPrice * (1 + item.taxRate / 100)).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button type="button" variant="ghost" size="icon" onClick={() => handleOpenItemDialog(item, idx)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(idx)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button type="button" variant="outline" onClick={() => handleOpenItemDialog()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Line Item
              </Button>
            </div>
            
            <div className="grid grid-cols-2">
                <div>
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
                </div>
                <div className="text-right space-y-1 text-sm">
                    <p>Subtotal: <span className="font-medium">{subtotal.toFixed(2)}</span></p>
                    <p>Tax: <span className="font-medium">{taxTotal.toFixed(2)}</span></p>
                    <p className="font-semibold text-base">Total: {total.toFixed(2)}</p>
                </div>
            </div>

            <Button type="submit" disabled={submitting} className="bg-accent hover:bg-accent/90">
              {submitting ? "Saving..." : "Save Draft"}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      {/* Item Add/Edit Dialog */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{typeof currentItem?.index === 'number' ? 'Edit' : 'Add'} Line Item</DialogTitle>
            <DialogDescription>
              Fill in the details for the invoice line item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item-description">Description</Label>
              <Input
                id="item-description"
                value={currentItem?.description || ''}
                onChange={(e) => setCurrentItem(prev => prev ? { ...prev, description: e.target.value } : null)}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item-quantity">Quantity</Label>
                <Input
                  id="item-quantity"
                  type="number"
                  value={currentItem?.quantity || 1}
                  onChange={(e) => setCurrentItem(prev => prev ? { ...prev, quantity: parseFloat(e.target.value) || 1 } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-unitPrice">Unit Price</Label>
                <Input
                  id="item-unitPrice"
                  type="number"
                  value={currentItem?.unitPrice || 0}
                  onChange={(e) => setCurrentItem(prev => prev ? { ...prev, unitPrice: parseFloat(e.target.value) || 0 } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-taxRate">Tax Rate (%)</Label>
                <Input
                  id="item-taxRate"
                  type="number"
                  value={currentItem?.taxRate || 0}
                  onChange={(e) => setCurrentItem(prev => prev ? { ...prev, taxRate: parseFloat(e.target.value) || 0 } : null)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleSaveItem}>
              {typeof currentItem?.index === 'number' ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
