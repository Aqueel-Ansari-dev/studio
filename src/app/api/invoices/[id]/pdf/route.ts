import { NextRequest } from 'next/server';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import { getSystemSettings } from '@/app/actions/admin/systemSettings';

export async function GET(_req: NextRequest, context: { params: { id: string } }) {
  const { id } = await context.params;
  try {
    const { settings } = await getSystemSettings();
    const pdf = await generateInvoicePdf(id, settings);
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=invoice-${id}.pdf`,
      },
    });
  } catch(error) {
    console.error(`Failed to generate PDF for invoice ${id}:`, error);
    return new Response('Invoice not found or failed to generate PDF.', { status: 404 });
  }
}
