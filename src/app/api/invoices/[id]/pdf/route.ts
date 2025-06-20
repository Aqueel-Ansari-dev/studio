import { NextRequest } from 'next/server';
import { generateInvoicePdf } from '@/lib/invoice-pdf';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const pdf = await generateInvoicePdf(params.id);
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=invoice-${params.id}.pdf`,
      },
    });
  } catch (err) {
    return new Response('Invoice not found', { status: 404 });
  }
}
