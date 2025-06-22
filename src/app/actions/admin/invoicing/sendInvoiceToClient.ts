
'use server';

import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import type { Invoice, SystemSettings } from '@/types/database';
import { getSystemSettings } from '@/app/actions/admin/systemSettings';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export interface SendInvoiceResult {
  success: boolean;
  message: string;
}

export async function sendInvoiceToClient(invoiceId: string, clientPhoneNumber: string): Promise<SendInvoiceResult> {
  const phoneRegex = /^\+\d{10,15}$/;
  if (!clientPhoneNumber || !phoneRegex.test(clientPhoneNumber)) {
    return { success: false, message: 'Invalid phone number format. Use + followed by the country code (e.g., +15551234567).' };
  }

  const invoiceRef = doc(db, 'invoices', invoiceId);
  const snap = await getDoc(invoiceRef);
  if (!snap.exists()) {
    return { success: false, message: 'Invoice not found.' };
  }
  const invoice = snap.data() as Invoice;

  try {
    const { settings } = await getSystemSettings();
    const pdfBytes = await generateInvoicePdf(invoiceId, settings);

    // Upload PDF to Firebase Storage
    const storageRef = ref(storage, `invoices/${invoiceId}/${invoice.invoiceNumber}.pdf`);
    await uploadBytes(storageRef, pdfBytes, { contentType: 'application/pdf' });
    const downloadUrl = await getDownloadURL(storageRef);

    // Send WhatsApp message with PDF link
    const messageBody = `Hi ${invoice.clientName},\n\nPlease find your invoice ${invoice.invoiceNumber} attached.\n\nTotal Due: ${invoice.total.toFixed(2)}\nDue Date: ${invoice.dueDate}\n\nThank you for your business!`;
    await sendWhatsAppMessage(clientPhoneNumber, messageBody, downloadUrl);

    // Update invoice status in Firestore
    await updateDoc(invoiceRef, { status: 'final', sentAt: serverTimestamp() });

    return { success: true, message: 'Invoice sent successfully via WhatsApp.' };
  } catch (error) {
    console.error(`Error sending invoice ${invoiceId} to ${clientPhoneNumber}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to send invoice: ${errorMessage}` };
  }
}
