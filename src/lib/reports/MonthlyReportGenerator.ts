import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { PayrollRecord, AttendanceLog, EmployeeExpense, SystemSettings } from '@/types/database';

/**
 * Generate a simple monthly summary PDF covering attendance, payroll and expenses.
 */
export async function generateMonthlyReport(
  logs: AttendanceLog[],
  payroll: PayrollRecord[],
  expenses: EmployeeExpense[],
  settings: SystemSettings | null,
  periodLabel: string,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 790;
  const margin = 50;

  const company = settings?.companyName || 'FieldOps';
  page.drawText(`${company} Monthly Report`, { x: margin, y, size: 18, font: bold });
  y -= 30;
  page.drawText(periodLabel, { x: margin, y, size: 14, font });
  y -= 25;

  const attendanceSummary = `Attendance logs: ${logs.length}`;
  const payrollTotal = payroll.reduce((s, r) => s + r.netPay, 0).toFixed(2);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0).toFixed(2);

  const lines = [
    attendanceSummary,
    `Payroll disbursed: ₹${payrollTotal}`,
    `Expenses reimbursed: ₹${expenseTotal}`,
  ];

  for (const line of lines) {
    page.drawText(line, { x: margin, y, size: 12, font });
    y -= 16;
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
