import { NextRequest } from 'next/server';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import { fetchAllInvoiceIds } from '@/app/actions/admin/invoicing/fetchAllInvoiceIds';

export async function generateStaticParams() {
  const result = await fetchAllInvoiceIds();
  if (!result.success || !result.ids) {
    console.error("Failed to generate static params for invoice PDFs:", result.error);
    return [];
  }
  return result.ids.map((invoice) => ({
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
  } catch(error) {
    console.error(`Failed to generate PDF for invoice ${id}:`, error);
    return new Response('Invoice not found or failed to generate PDF.', { status: 404 });
  }
}
