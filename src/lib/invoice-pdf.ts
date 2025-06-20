import PDFDocument from 'pdfkit';
import { getDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import type { Invoice } from '@/types/database';

export async function generateInvoicePdf(invoiceId: string): Promise<Buffer> {
  const snap = await getDoc(doc(db, 'invoices', invoiceId));
  if (!snap.exists()) {
    throw new Error('Invoice not found');
  }
  const invoice = snap.data() as Invoice;
  const pdf = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  pdf.on('data', (d) => chunks.push(d));
  return new Promise((resolve, reject) => {
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.fontSize(20).text('Invoice', { align: 'center' });
    pdf.moveDown();
    pdf.text(`Invoice #: ${invoice.invoiceNumber}`);
    pdf.text(`Project: ${invoice.projectId}`);
    pdf.text(`Client: ${invoice.clientId}`);
    pdf.text(`Invoice Date: ${invoice.invoiceDate}`);
    pdf.text(`Due Date: ${invoice.dueDate}`);
    pdf.moveDown();
    invoice.items.forEach((item) => {
      const line = `${item.description} - ${item.quantity} x ${item.unitPrice.toFixed(2)} (Tax ${item.taxRate}%)`;
      pdf.text(line);
    });
    pdf.moveDown();
    pdf.text(`Subtotal: ${invoice.subtotal.toFixed(2)}`);
    pdf.text(`Tax: ${invoice.taxTotal.toFixed(2)}`);
    pdf.text(`Total: ${invoice.total.toFixed(2)}`);
    pdf.end();
  });
}
