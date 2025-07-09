
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import type { Invoice, Project, SystemSettings } from '@/types/database';

function hexToRgb(hex: string): { r: number; g: number; b: number } | undefined {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : undefined;
}


/**
 * Generate a professional looking invoice PDF using pdf-lib.
 * This does not rely on any native binaries so it works in serverless envs.
 */
export async function generateInvoicePdf(organizationId: string, invoiceId: string, systemSettings: SystemSettings | null): Promise<Buffer> {
  const invoiceDocRef = doc(db, 'organizations', organizationId, 'invoices', invoiceId);
  const snap = await getDoc(invoiceDocRef);
  
  if (!snap.exists()) {
    throw new Error(`Invoice not found for ID ${invoiceId} in organization ${organizationId}`);
  }
  const invoice = snap.data() as Invoice;

  const projectDocRef = doc(db, 'organizations', organizationId, 'projects', invoice.projectId);
  const projSnap = await getDoc(projectDocRef);
  const projectName = projSnap.exists() ? (projSnap.data() as Project).name : invoice.projectId;

  const clientName = invoice.clientName;

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = height - margin;

  const primaryColorRgb = systemSettings?.primaryColor ? hexToRgb(systemSettings.primaryColor) : rgb(0.2, 0.2, 0.2);

  // Handle Logo
  if (systemSettings?.companyLogoUrl) {
    try {
        const logoImageBytes = await fetch(systemSettings.companyLogoUrl).then(res => res.arrayBuffer());
        let logoImage;
        if (systemSettings.companyLogoUrl.toLowerCase().endsWith('.png')) {
            logoImage = await pdfDoc.embedPng(logoImageBytes);
        } else {
            logoImage = await pdfDoc.embedJpg(logoImageBytes);
        }
        
        const logoDims = logoImage.scale(0.25);
        page.drawImage(logoImage, {
            x: margin,
            y: y - logoDims.height + 15,
            width: logoDims.width,
            height: logoDims.height,
        });
        y -= (logoDims.height);
    } catch(e) {
      console.error("Could not embed logo into PDF:", e);
    }
  }


  // Header
  const companyName = systemSettings?.companyName || "FieldOps MVP";
  page.drawText(companyName, { x: margin, y, size: 18, font: bold });
  const title = 'INVOICE';
  page.drawText(title, {
    x: width - margin - bold.widthOfTextAtSize(title, 24),
    y: height - margin,
    size: 24,
    font: bold,
    color: primaryColorRgb,
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
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: primaryColorRgb || rgb(0.8, 0.8, 0.8) });
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
