import { getDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import type { Invoice } from '@/types/database';

export async function generateInvoicePdf(invoiceId: string): Promise<Buffer> {
  const snap = await getDoc(doc(db, 'invoices', invoiceId));
  if (!snap.exists()) {
    throw new Error('Invoice not found');
  }
  const invoice = snap.data() as Invoice;

  const projSnap = await getDoc(doc(db, 'projects', invoice.projectId));
  const projectName = projSnap.exists() ? (projSnap.data() as any).name : invoice.projectId;

  const clientSnap = await getDoc(doc(db, 'users', invoice.clientId));
  const clientData = clientSnap.exists() ? (clientSnap.data() as any) : null;
  const clientName = clientData?.displayName || clientData?.email || invoice.clientId;

  const tableHeader = 'Description             Qty   Unit Price   Tax%   Line Total';
  const itemsLines = invoice.items.map((i) => {
    const lineTotal = i.quantity * i.unitPrice * (1 + i.taxRate / 100);
    return `${i.description.padEnd(22).slice(0,22)} ${String(i.quantity).padStart(4)} ${i.unitPrice.toFixed(2).padStart(11)} ${(`${i.taxRate}%`).padStart(6)} ${lineTotal.toFixed(2).padStart(11)}`;
  });

  const lines = [
    'ACME Corp',
    'INVOICE',
    '',
    `Invoice #: ${invoice.invoiceNumber}`,
    `Project: ${projectName}`,
    `Client: ${clientName}`,
    `Invoice Date: ${invoice.invoiceDate}`,
    `Due Date: ${invoice.dueDate}`,
    '',
    tableHeader,
    '--------------------------------------------------------------',
    ...itemsLines,
    '--------------------------------------------------------------',
    `Subtotal: ${invoice.subtotal.toFixed(2)}`,
    `Tax: ${invoice.taxTotal.toFixed(2)}`,
    `Total: ${invoice.total.toFixed(2)}`,
    invoice.notes ? `Notes: ${invoice.notes}` : '',
  ];

  function escape(str: string) {
    return str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }

  const textLines = lines
    .map((l) => `(${escape(l)}) Tj`)
    .map((l, idx) => (idx === 0 ? l : `T* ${l}`))
    .join("\n");

  const content = `BT\n/F1 12 Tf\n14 TL\n1 0 0 1 72 720 Tm\n${textLines}\nET`;

  const objects: string[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>"); // 1
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"); // 2
  objects.push(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>"
  ); // 3
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`); // 4
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"); //5

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (let i = 0; i < objects.length; i++) {
    offsets[i + 1] = pdf.length;
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf);
}
