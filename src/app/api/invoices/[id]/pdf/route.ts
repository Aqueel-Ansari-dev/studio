import { NextRequest } from 'next/server';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import { fetchAllInvoiceIds } from '@/app/actions/admin/invoicing/fetchAllInvoiceIds';

export async function generateStaticParams() {
  const invoices = await fetchAllInvoiceIds();
  return invoices.map((invoice) => ({
    id: invoice.id,
  }));
}

export async function GET(_req: NextRequest, context: { params: { id: string } }) {
  const { id } = await context.params;
  try {
    const pdf = await generateInvoicePdf(id);
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=invoice-${id}.pdf`,
      },
    });
  } catch {
    return new Response('Invoice not found', { status: 404 });
  }
}
