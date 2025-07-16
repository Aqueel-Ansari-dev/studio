// Defines the core data structures for the FieldOps MVP application.
import type { Timestamp } from 'firebase/firestore';

/**
 * Defines the possible roles a user can have within the system.
 */
export type UserRole = 'employee' | 'supervisor' | 'admin' | 'owner';

/**
 * Defines the pay modes for an employee.
 */
export type PayMode = 'hourly' | 'daily' | 'monthly' | 'not_set';

/** Bank account details for payouts */
export interface BankDetails {
  accountNumber: string;
  ifscOrSwift: string;
  accountHolderName: string;
  upiId?: string;
}


/**
 * Represents the top-level Organization document.
 */
export interface Organization {
  id: string; // Firestore document ID
  name: string;
  createdAt: Timestamp | string;
  ownerId: string; // UID of the admin who created the org
  planId?: 'free' | 'pro' | 'business' | 'enterprise'; // The ID of the currently active plan
  subscriptionStatus?: 'active' | 'trialing' | 'canceled' | 'overdue' | 'paused';
  trialEndsAt?: Timestamp | string | null;
  billingCycle?: 'monthly' | 'yearly';
  gdriveRefreshToken?: string | null;
  gdriveFolderId?: string | null;
  gdriveFolderName?: string | null;
  gdriveFolderPath?: string | null;
  gdriveConnectedEmail?: string | null;
  gdriveLastSync?: Timestamp | string | null;
}


/**
 * Represents a user in the system (stored in 'users' collection).
 * This is the primary schema for documents in the 'users' collection.
 */
export interface User {
  id: string; // Firebase UID
  email: string;
  role: UserRole; 
  organizationId: string;
  planId?: 'free' | 'pro' | 'business' | 'enterprise';
  subscriptionStatus?: 'active' | 'trialing' | 'canceled' | 'overdue' | 'paused';
  trialEndsAt?: Timestamp | string | null;
  displayName?: string | null;
  photoURL?: string | null;
  payMode?: PayMode; // Employee's pay mode, defaults to 'not_set'
  rate?: number; // Pay rate (e.g., per hour, per day), defaults to 0
  phoneNumber?: string; // WhatsApp-compatible international format
  whatsappOptIn?: boolean; // True if user wants WhatsApp notifications
  isActive?: boolean; // True if account is active, false if disabled/inactive. Defaults to true.
  createdAt?: string; // ISO string of user creation
  branding?: {
    companyName?: string;
    companyLogoUrl?: string | null;
    primaryColor?: string | null;
    customHeaderTitle?: string | null;
  };
  /** Bank details used for salary disbursement */
  bankDetails?: BankDetails | null;
}

export interface UserForSelection {
  id: string; // Firebase UID
  name: string; 
  avatar?: string; // Optional avatar URL
  role: UserRole; 
}


/**
 * Defines the possible statuses a project can have.
 */
export type ProjectStatus = 'active' | 'completed' | 'paused' | 'inactive';

/**
 * Represents a project that tasks can be associated with.
 */
export interface Project {
  id: string; // Unique identifier for the project
  name: string;
  description: string;
  imageUrl?: string; // Optional URL for a project image
  dataAiHint?: string; // Optional hint for AI image generation/search
  clientInfo?: string; // Optional field for client name or contact
  assignedEmployeeIds?: string[]; // IDs of employees assigned to this project
  assignedSupervisorIds?: string[]; // IDs of supervisors assigned to manage this project
  createdAt?: string | Timestamp; // ISO date string or Timestamp
  createdBy?: string; // UID of the admin who created the project
  dueDate?: string | Timestamp | null; // Optional: ISO date string or Timestamp for project deadline
  budget?: number | null; // Total budget for the project
  materialCost?: number | null;
  updatedAt?: Timestamp | string | null; // For sorting or tracking updates
  status: ProjectStatus; // Status of the project
  statusOrder?: number; // Order within the Kanban column
}

/**
 * Defines the possible statuses a task can have.
 */
export type TaskStatus =
  | 'pending'
  | 'in-progress'
  | 'paused'
  | 'completed'
  | 'needs-review'
  | 'verified'
  | 'rejected';

/**
 * Represents a task assigned to an employee within a project.
 * Timestamps are stored as Firestore Timestamps.
 * Client-side representations might be string (ISO) or number (milliseconds).
 */
export interface Task {
  id: string;
  projectId: string;
  assignedEmployeeId: string;
  taskName: string;
  description: string;
  status: TaskStatus;
  dueDate?: Timestamp | string | null;

  startTime?: Timestamp | number | null; // Firestore Timestamp or millis
  endTime?: Timestamp | number | null;   // Firestore Timestamp or millis
  elapsedTime?: number; // Duration in seconds

  createdAt: Timestamp | string; // Firestore Timestamp or ISO string
  updatedAt: Timestamp | string; // Firestore Timestamp or ISO string

  createdBy: string; // Supervisor/Admin UID
  supervisorNotes?: string;

  /** Whether this task is marked as important */
  isImportant?: boolean;

  employeeNotes?: string;
  submittedMediaUri?: string;

  aiComplianceNotes?: string;
  aiRisks?: string[];

  supervisorReviewNotes?: string;
  reviewedBy?: string; // Supervisor/Admin UID
  reviewedAt?: Timestamp | number | null; // Firestore Timestamp or millis
}

export type ArrivalStatus = 'early' | 'on-time' | 'late';
export type DepartureStatus = 'left-early' | 'on-time' | 'overtime';

export type AttendanceReviewStatus = 'pending' | 'approved' | 'rejected';
export type AttendanceOverrideStatus = 'present' | 'absent' | 'half-day' | 'week-off' | 'holiday' | 'on-leave';


/**
 * Represents an attendance record for an employee.
 * Stored in 'attendanceLogs' collection.
 */
export interface AttendanceLog {
  id: string; // Auto-generated Firestore document ID
  employeeId: string;
  projectId: string; // Project worker is associated with during this attendance
  date: string; // yyyy-mm-dd format, for daily querying
  checkInTime: Timestamp | string | null; // Allow string for ISO on client
  checkOutTime?: Timestamp | string | null; // Allow string for ISO on client
  gpsLocationCheckIn: { lat: number; lng: number; accuracy?: number; timestamp?: number };
  gpsLocationCheckOut?: { lat: number; lng: number; accuracy?: number; timestamp?: number } | null;
  autoLoggedFromTask?: boolean; // True if this log was created automatically when a task started
  locationTrack?: Array<{ timestamp: Timestamp | string | number; lat: number; lng: number }>; // Optional periodic tracking
  selfieCheckInUrl?: string;
  selfieCheckOutUrl?: string;
  reviewStatus?: AttendanceReviewStatus;
  reviewedBy?: string; // UID of supervisor/admin
  reviewedAt?: Timestamp | string | null; // Firestore Timestamp or ISO string for client
  reviewNotes?: string; // Optional notes from reviewer
  updatedAt?: Timestamp | string | null; // For sorting or tracking updates
  overrideStatus?: AttendanceOverrideStatus | null; // Admin-set status for the day
  createdAt?: Timestamp | string;
  arrivalStatus?: ArrivalStatus;
  departureStatus?: DepartureStatus;


  completedTaskIds?: string[]; // IDs of tasks marked as completed during this session
  sessionNotes?: string; // General notes for the work session
  sessionPhotoUrl?: string; // URL for a single photo submitted with punch-out
  sessionAudioNoteUrl?: string; // URL for an audio note submitted with punch-out
  gdriveSessionPhotoUrl?: string;
  gdriveSessionAudioNoteUrl?: string;
}

/**
 * Represents media (image, video) attached to a task.
 * Stored in 'taskMedia' collection.
 */
export interface TaskMedia {
  id: string; // Auto-generated Firestore document ID
  taskId: string;
  employeeId: string;
  type: 'image' | 'video'; // Add 'note' later if needed
  url: string; // URL to the media file in Firebase Storage or other provider
  fileName?: string;
  mimeType?: string;
  size?: number;
  uploadedAt: Timestamp; // Firestore Timestamp
}


/**
 * Represents an item in the project inventory.
 * Stored in 'projectInventory' collection.
 */
export interface InventoryItem {
  id: string;
  projectId: string;
  itemName: string;
  quantity: number;
  unit: 'kg' | 'pcs' | 'm' | 'liters' | 'custom';
  costPerUnit: number;
  createdBy: string;
  createdAt: Timestamp | string; // Firestore Timestamp or ISO string
  customUnitLabel?: string;
}

/**
 * Represents an expense logged by an employee.
 * Stored in 'employeeExpenses' collection.
 */
export interface EmployeeExpense {
  id: string;
  employeeId: string;
  projectId: string;
  type: 'travel' | 'food' | 'tools' | 'other';
  amount: number;
  notes: string;
  receiptImageUri?: string;
  gdriveReceiptUrl?: string;
  createdAt: Timestamp | string; // Firestore Timestamp or ISO string
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Timestamp | string | null; // Firestore Timestamp or ISO string
  rejectionReason?: string | null;
  reviewedAt?: Timestamp | string | null; // Firestore Timestamp or ISO string
  /** Set to true once the expense has been included in a payroll run */
  processed?: boolean;
}

// ----- PAYROLL MODULE TYPES -----
export interface EmployeeRate {
  id: string;
  employeeId: string;
  paymentMode: 'hourly' | 'daily' | 'monthly';
  hourlyRate?: number;
  dailyRate?: number;
  monthlyRate?: number;
  effectiveFrom: Timestamp | string; // Firestore Timestamp in DB, string (ISO) on client
  updatedBy: string; // adminId or supervisorId who set/updated this rate
  createdAt: Timestamp | string; // Firestore Timestamp in DB, string (ISO) on client
}

/** Details of a deduction applied to a payroll record */
export interface PayrollDeduction {
  type: 'tax' | 'custom';
  reason: string;
  amount: number;
}

/** Bonus entry applied to payroll */
export interface PayrollBonus {
  type: 'performance' | 'project' | 'festival' | 'other';
  reason: string;
  amount: number;
}

/** Allowance entry applied to payroll */
export interface PayrollAllowance {
  name: string;
  amount: number;
}

/**
 * Represents a generated payroll record for an employee for a specific project and pay period.
 * Stored in 'payrollRecords' collection.
 * Timestamps here are stored as Firestore Timestamps in the DB,
 * but might be converted to ISO strings when fetched by server actions for client use.
 */
export interface PayrollRecord {
  id: string;
  employeeId: string;
  projectId: string;
  payPeriod: {
    start: Timestamp | string; // Firestore Timestamp or ISO string
    end: Timestamp | string;   // Firestore Timestamp or ISO string
  };
  hoursWorked: number;
  hourlyRate: number; // Rate used for this calculation if applicable
  taskPay: number;
  approvedExpenses: number;
  /** Bonuses applied for this pay period */
  bonuses?: PayrollBonus[];
  /** Allowances applied for this pay period */
  allowances?: PayrollAllowance[];
  /** Regular hours beyond which overtime begins */
  overtimeHours?: number;
  overtimePay?: number;
  /** Gross pay = taskPay + overtimePay + approvedExpenses */
  grossPay: number;
  /** List of deductions applied (tax or custom) */
  deductions: PayrollDeduction[];
  /** Net amount after all deductions */
  netPay: number;
  generatedBy: string;
  generatedAt: Timestamp | string; // Firestore Timestamp or ISO string
  taskIdsProcessed: string[];
  expenseIdsProcessed: string[];
  payrollStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string | null;
  approvedAt?: Timestamp | string | null;
  rejectionReason?: string | null;
  approverNotes?: string | null;
  /** Reference to the payroll run this record belongs to */
  payRunId?: string | null;
  /** When true, the record is locked from further edits */
  locked?: boolean;
}

/** Tax deduction rule stored at the organization level */
export interface TaxRule {
  id: string;
  organizationId: string;
  employeeType?: string;
  /** Minimum income this rule applies to */
  minIncome?: number;
  /** Maximum income this rule applies to */
  maxIncome?: number;
  /** Percent rate expressed as 0-1 */
  rate: number;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

/** Custom deduction assigned to an employee */
export interface EmployeeDeduction {
  id: string;
  organizationId: string;
  employeeId: string;
  reason: string;
  amount: number;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

/**
 * Configuration for automatic pay cycles at the organization level.
 * Stored in the 'payCycles' collection.
 */
export interface PayCycleConfig {
  id: string;
  organizationId: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  nextCycleStart: Timestamp | string;
  nextCycleEnd: Timestamp | string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

/** Record of a payout attempt for a payroll entry */
export interface PayoutRecord {
  id: string;
  organizationId: string;
  payrollRecordId: string;
  employeeId: string;
  amount: number;
  method: 'auto' | 'manual';
  status: 'pending' | 'success' | 'failed';
  failureReason?: string | null;
  createdAt: Timestamp | string;
  processedAt?: Timestamp | string | null;
}

/** Record of a payroll run, representing a disbursement batch */
export interface PayrollRun {
  id: string;
  organizationId: string;
  periodStart: Timestamp | string;
  periodEnd: Timestamp | string;
  totalAmount: number;
  status: 'pending' | 'paid';
  createdBy: string;
  createdAt: Timestamp | string;
}

/** Summary data returned by analytics helpers */
export interface MonthlyPayrollSummary {
  totalAmount: number;
  employeeCount: number;
  averageSalary: number;
}

/**
 * Represents an employee leave request.
 * Stored in 'leaveRequests' collection.
 */
export interface LeaveRequest {
  id: string;
  employeeId: string;
  projectId?: string;
  fromDate: Timestamp | string;
  toDate: Timestamp | string;
  leaveType: 'sick' | 'casual' | 'unpaid';
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string; // UID of supervisor/admin
  reviewedAt?: Timestamp | string;
  createdAt: Timestamp | string;
}

export type NotificationType =
  | 'task-assigned'
  | 'task-started'
  | 'task-completed' // General completion, typically when status becomes 'completed' or 'verified'
  | 'task-needs-review' // Specifically when a task is submitted and AI or rules flag it for manual review
  | 'expense-logged'
  | 'attendance-check-in'
  | 'attendance-log-review-needed' // New notification type for when an attendance log is ready for review
  | 'leave-requested'
  | 'task-approved-by-supervisor' // Admin notification
  | 'task-rejected-by-supervisor' // Admin notification
  | 'expense-approved-by-supervisor' // Admin notification
  | 'expense-rejected-by-supervisor' // Admin notification
  | 'leave-approved-by-supervisor' // Admin notification
  | 'leave-rejected-by-supervisor' // Admin notification
  | 'dpr-submitted'
  | 'late-arrival' // Supervisor notification
  | 'early-departure';

export type RelatedItemType =
  | 'task'
  | 'expense'
  | 'leave_request'
  | 'attendance_log'
  | 'dpr'
  | 'user'
  | 'project'
  | 'none';

export type NotificationPriority = 'normal' | 'high' | 'critical';
export type NotificationCategory =
  | 'task'
  | 'attendance'
  | 'expense'
  | 'payroll'
  | 'admin'
  | 'general';

/**
 * Represents an in-app notification for a user.
 * Stored in 'notifications' collection.
 */
export interface Notification {
  id: string;
  userId: string; // ID of the user who should receive this notification (supervisor, admin)
  organizationId: string; // Added to enable security rules based on org
  type: NotificationType;
  title: string;
  body: string;
  relatedItemId?: string; // ID of the task, expense, leave request, etc.
  relatedItemType?: RelatedItemType; // To help UI know what 'relatedItemId' refers to
  category: NotificationCategory;
  priority: NotificationPriority;
  read: boolean;
  createdAt: Timestamp;
}

// ----- INVOICING TYPES -----

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number; // percentage e.g. 15 for 15%
}

export type InvoiceStatus = 'draft' | 'final' | 'paid';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  projectId: string;
  clientName: string;
  items: InvoiceItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  invoiceDate: string;
  dueDate: string;
  notes?: string;
  status: InvoiceStatus;
  createdAt: Timestamp | string;
  updatedAt?: Timestamp | string | null;
  sentAt?: Timestamp | string | null;
}

/**
 * Represents a Daily Progress Report (DPR).
 * Stored in 'dprs' collection.
 */
export interface DPR {
  id: string;
  organizationId: string;
  projectId: string;
  supervisorId: string;
  reportDate: Timestamp | string; // Date the report is for
  progressPercentage: number; // 0-100
  summary: string;
  notes?: string;
  mediaUrls?: string[]; // URLs to photos/videos in Firebase Storage
  siteConditions?: string;
  issuesOrDelays?: string;
  createdAt: Timestamp | string; // When the report was submitted
}

export interface SystemSettings {
  id: string; // Should always be 'companySettings' within an org's subcollection
  organizationId: string;
  companyName: string;
  companyLogoUrl?: string | null;
  paidLeaves?: number;
  primaryColor?: string | null;
  customHeaderTitle?: string | null;
  /** Preferred payout method for payroll */
  defaultPayoutMethod?: 'auto' | 'manual';
  /** Minimum balance required before automatic payouts */
  minimumBalanceThreshold?: number;
  /** Template for WhatsApp payout notifications */
  payoutNotificationTemplate?: string;
  updatedAt: Timestamp | string;
}

/**
 * Represents a reusable task template for quick creation.
 * Stored in 'predefinedTasks' collection.
 */
export interface PredefinedTask {
  id: string;
  name: string;
  description: string;
  targetRole: 'employee' | 'supervisor' | 'all';
  createdBy: string; // admin UID
  createdAt: Timestamp | string;
}

// --- ISSUE TRACKING ---
export type IssueStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type IssueSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface Issue {
  id: string;
  organizationId: string;
  projectId: string;
  taskId?: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  status: IssueStatus;
  isEscalated?: boolean;
  mediaUrl?: string;
  location?: { lat: number; lng: number };
  reportedBy: string; // User ID
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
  resolvedAt?: Timestamp | string;
}

// ----- TRAINING MODULE TYPES -----
export interface TrainingMaterial {
  id: string; // Firestore doc ID
  videoId: string; // YouTube video ID
  videoUrl: string;
  title: string;
  thumbnailUrl: string;
  category: string;
  description?: string;
  createdBy: string; // Admin User ID
  createdAt: Timestamp | string;
}

export interface UserWatchedTraining {
  // Stored as subcollection under users/{userId}/watchedTraining/{materialId}
  materialId: string;
  watchedAt: Timestamp | string;
}
// ----- END TRAINING MODULE TYPES -----
// ----- END INVOICING TYPES -----
// ----- END PAYROLL MODULE TYPES -----

/**
 * Represents a log of a significant action taken in the system.
 * Stored in 'auditLogs' collection.
 */
export type AuditActionType =
  | 'user_update'
  | 'user_delete'
  | 'project_create'
  | 'project_update'
  | 'project_delete'
  | 'task_assign'
  | 'task_start'
  | 'task_pause'
  | 'task_complete'
  | 'unknown';

export interface AuditLog {
  id: string;
  actorId: string; // UID of the user who performed the action
  actorName?: string; // Name of the actor for readability
  action: AuditActionType;
  timestamp: Timestamp;
  details: string; // Human-readable description of the action
  targetId?: string; // ID of the entity that was affected (e.g., userId, projectId, taskId)
  targetType?: 'user' | 'project' | 'task';
  payloadHash?: string; // Simple hash or string representation of the action's payload
}

/**
 * Represents a user invitation.
 * Stored in the top-level 'invites' collection for easy lookup by ID.
 */
export interface Invite {
  id: string; // Firestore document ID (which is the invite token)
  organizationId: string;
  email: string;
  role: UserRole;
  inviterId: string; // UID of the admin who sent the invite
  createdAt: Timestamp;
  expiresAt: Timestamp;
  status: 'pending' | 'accepted';
  // Optional fields that can be pre-filled
  displayName?: string;
  phoneNumber?: string;
}

/**
 * A simple type definition for a plan's features and limits.
 * Now stored in Firestore.
 */
export type PlanFeature = 'Tasks' | 'Attendance' | 'Expenses' | 'Payroll' | 'Invoicing' | 'Advanced Reporting' | 'Priority Support';

export interface Plan {
  id: 'free' | 'pro' | 'business' | 'enterprise';
  name: string;
  priceMonthly: number;
  priceYearly: number;
  userLimit: number;
  features: PlanFeature[];
  recommended?: boolean;
  contactUs?: boolean;
}
