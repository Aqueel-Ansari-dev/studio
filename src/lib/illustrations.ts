const illustrations = {
  adminDashboard: '/illustrations/admin_dashboard.svg',
  punchInOut: '/illustrations/punch_in_out.svg',
  taskManagement: '/illustrations/task_management.svg',
  expenseSubmission: '/illustrations/expense_submission.svg',
  payroll: '/illustrations/payroll.svg',
  attendanceStatus: '/illustrations/attendance_status.svg',
  whatsappNotifications: '/illustrations/whatsapp_notifications.svg'
} as const;

export type IllustrationKey = keyof typeof illustrations;
export default illustrations;
