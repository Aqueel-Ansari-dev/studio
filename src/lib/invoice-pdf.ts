import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import type { Invoice, SystemSettings } from '@/types/database';

/**
 * Generate a professional looking invoice PDF using pdf-lib.
 * This does not rely on any native binaries so it works in serverless envs.
 */
export async function generateInvoicePdf(invoiceId: string, systemSettings: SystemSettings | null): Promise<Buffer> {
  const snap = await getDoc(doc(db, 'invoices', invoiceId));
  if (!snap.exists()) {
    throw new Error('Invoice not found');
  }
  const invoice = snap.data() as Invoice;

  const projSnap = await getDoc(doc(db, 'projects', invoice.projectId));
  const projectName = projSnap.exists() ? (projSnap.data() as any).name : invoice.projectId;

  const clientName = invoice.clientName;

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = height - margin;

  // Header
  const companyName = systemSettings?.companyName || "FieldOps MVP";
  page.drawText(companyName, { x: margin, y, size: 18, font: bold });
  const title = 'INVOICE';
  page.drawText(title, {
    x: width - margin - bold.widthOfTextAtSize(title, 24),
    y,
    size: 24,
    font: bold,
    color: rgb(0.2, 0.2, 0.2),
  });

  y -= 40;
  const infoSize = 12;
  const info = [
    `Invoice #: ${invoice.invoiceNumber}`,
    `Project: ${projectName}`,
    `Client: ${clientName}`,
    `Invoice Date: ${invoice.invoiceDate}`,
    `Due Date: ${invoice.dueDate}`,
  ];
  for (const line of info) {
    page.drawText(line, { x: margin, y, size: infoSize, font });
    y -= 16;
  }

  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 20;

  // Table headers
  const columns = ['Description', 'Qty', 'Unit Price', 'Tax %', 'Line Total'];
  const colWidths = [240, 40, 80, 60, 80];
  let x = margin;
  for (let i = 0; i < columns.length; i++) {
    page.drawText(columns[i], { x, y, size: 12, font: bold });
    x += colWidths[i];
  }
  y -= 15;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 12;

  // Table rows
  for (const item of invoice.items) {
    x = margin;
    const lineTotal = item.quantity * item.unitPrice * (1 + item.taxRate / 100);
    const row = [
      item.description,
      String(item.quantity),
      item.unitPrice.toFixed(2),
      `${item.taxRate}%`,
      lineTotal.toFixed(2),
    ];
    for (let i = 0; i < row.length; i++) {
      page.drawText(row[i], { x, y, size: 11, font });
      x += colWidths[i];
    }
    y -= 16;
  }
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 20;

  // Totals
  const totals = [
    ['Subtotal', invoice.subtotal.toFixed(2)],
    ['Tax', invoice.taxTotal.toFixed(2)],
    ['Total', invoice.total.toFixed(2)],
  ];
  x = width - margin - 100;
  for (const [label, value] of totals) {
    page.drawText(label, { x, y, size: 12, font });
    page.drawText(value, { x: width - margin - 10 - font.widthOfTextAtSize(value, 12), y, size: 12, font });
    y -= 16;
  }

  if (invoice.notes) {
    y -= 20;
    page.drawText('Notes:', { x: margin, y, size: 12, font: bold });
    y -= 14;
    const lines = splitText(invoice.notes, 80);
    for (const line of lines) {
      page.drawText(line, { x: margin, y, size: 11, font });
      y -= 14;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function splitText(text: string, maxLen: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxLen) {
      lines.push(current.trim());
      current = w;
    } else {
      current += ` ${w}`;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}
