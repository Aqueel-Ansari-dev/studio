import { getDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import type { Invoice } from '@/types/database';

export async function generateInvoicePdf(invoiceId: string): Promise<Buffer> {
  const snap = await getDoc(doc(db, "invoices", invoiceId));
  if (!snap.exists()) {
    throw new Error("Invoice not found");
  }
  const invoice = snap.data() as Invoice;

  const lines = [
    `Invoice #: ${invoice.invoiceNumber}`,
    `Project: ${invoice.projectId}`,
    `Client: ${invoice.clientId}`,
    `Invoice Date: ${invoice.invoiceDate}`,
    `Due Date: ${invoice.dueDate}`,
    "",
    ...invoice.items.map(
      (i) =>
        `${i.description} - ${i.quantity} x ${i.unitPrice.toFixed(2)} (Tax ${i.taxRate}%)`
    ),
    "",
    `Subtotal: ${invoice.subtotal.toFixed(2)}`,
    `Tax: ${invoice.taxTotal.toFixed(2)}`,
    `Total: ${invoice.total.toFixed(2)}`,
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
