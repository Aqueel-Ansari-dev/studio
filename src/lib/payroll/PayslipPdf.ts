import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { PayrollRecord, SystemSettings } from '@/types/database';

/**
 * Generate a simple payslip PDF for an employee.
 * This relies solely on pdf-lib so it can run in serverless environments.
 */
export async function generatePayslipPdf(
  record: PayrollRecord,
  settings: SystemSettings | null,
  employeeName = 'Employee'
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = 790;

  const company = settings?.companyName || 'FieldOps';
  page.drawText(company, { x: margin, y, size: 18, font: bold });
  y -= 30;

  page.drawText(`Payslip for ${employeeName}`, { x: margin, y, size: 14, font: bold });
  y -= 20;

  const start = typeof record.payPeriod.start === 'string'
    ? record.payPeriod.start
    : record.payPeriod.start.toDate().toISOString().slice(0, 10);
  const end = typeof record.payPeriod.end === 'string'
    ? record.payPeriod.end
    : record.payPeriod.end.toDate().toISOString().slice(0, 10);
  page.drawText(`Period: ${start} - ${end}`, { x: margin, y, size: 12, font });
  y -= 25;

  const lines = [
    `Base Pay: ₹${record.taskPay.toFixed(2)}`,
    `Overtime: ₹${(record.overtimePay ?? 0).toFixed(2)}`,
    `Bonuses: ₹${(record.bonuses?.reduce((s, b) => s + b.amount, 0) || 0).toFixed(2)}`,
    `Allowances: ₹${(record.allowances?.reduce((s, a) => s + a.amount, 0) || 0).toFixed(2)}`,
    `Expenses Reimbursed: ₹${record.approvedExpenses.toFixed(2)}`,
    `Gross Pay: ₹${record.grossPay.toFixed(2)}`,
    `Deductions: ₹${record.deductions.reduce((s, d) => s + d.amount, 0).toFixed(2)}`,
    `Net Pay: ₹${record.netPay.toFixed(2)}`,
  ];

  for (const line of lines) {
    page.drawText(line, { x: margin, y, size: 12, font });
    y -= 16;
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
