
// Defines the core data structures for the FieldOps MVP application.
import type { Timestamp } from 'firebase/firestore';

/**
 * Defines the possible roles a user can have within the system.
 */
export type UserRole = 'employee' | 'supervisor' | 'admin';

/**
 * Defines the pay modes for an employee.
 */
export type PayMode = 'hourly' | 'daily' | 'monthly' | 'not_set';

/**
 * Represents an employee user in the system (stored in 'users' collection).
 * This is the primary schema for documents in the 'users' collection.
 */
export interface Employee {
  id: string; // Firebase UID
  email: string;
  role: UserRole;
  displayName?: string | null;
  photoURL?: string | null;
  assignedProjectIds?: string[]; // IDs of projects assigned to this employee
  payMode?: PayMode; // Employee's pay mode, defaults to 'not_set'
  rate?: number; // Pay rate (e.g., per hour, per day), defaults to 0
  phoneNumber?: string; // WhatsApp-compatible international format
  whatsappOptIn?: boolean; // True if user wants WhatsApp notifications
  isActive?: boolean; // True if account is active, false if disabled/inactive. Defaults to true.
  createdAt?: string; // ISO string of user creation
}

/**
 * Defines the possible statuses a project can have.
 */
export type ProjectStatus = 'active' | 'completed' | 'inactive';

/**
 * Represents a project that tasks can be associated with.
 */
export interface Project {
  id: string; // Unique identifier for the project
  name: string;
  description: string;
  imageUrl?: string; // Optional URL for a project image
  dataAiHint?: string; // Optional hint for AI image generation/search
  assignedEmployeeIds?: string[]; // IDs of employees assigned to this project
  assignedSupervisorIds?: string[]; // IDs of supervisors assigned to manage this project
  createdAt?: string | Timestamp; // ISO date string or Timestamp
  createdBy?: string; // UID of the admin who created the project
  dueDate?: string | Timestamp | null; // Optional: ISO date string or Timestamp for project deadline
  budget?: number | null; // Total budget for the project
  materialCost?: number | null;
  updatedAt?: Timestamp | string | null; // For sorting or tracking updates
  status?: ProjectStatus; // Status of the project
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

export type AttendanceReviewStatus = 'pending' | 'approved' | 'rejected';

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


  completedTaskIds?: string[]; // IDs of tasks marked as completed during this session
  sessionNotes?: string; // General notes for the work session
  sessionPhotoUrl?: string; // URL for a single photo submitted with punch-out
  sessionAudioNoteUrl?: string; // URL for an audio note submitted with punch-out
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
  createdAt: Timestamp | string; // Firestore Timestamp or ISO string
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Timestamp | string | null; // Firestore Timestamp or ISO string
  rejectionReason?: string | null;
  reviewedAt?: Timestamp | string | null; // Firestore Timestamp or ISO string
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
  deductions?: number; // Kept optional as deduction logic is planned
  totalPay: number;
  generatedBy: string;
  generatedAt: Timestamp | string; // Firestore Timestamp or ISO string
  taskIdsProcessed: string[];
  expenseIdsProcessed: string[];
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
  | 'leave-rejected-by-supervisor'; // Admin notification

export type RelatedItemType =
  | 'task'
  | 'expense'
  | 'leave_request'
  | 'attendance_log'
  | 'user'
  | 'project'
  | 'none';

/**
 * Represents an in-app notification for a user.
 * Stored in 'notifications' collection.
 */
export interface Notification {
  id: string;
  userId: string; // ID of the user who should receive this notification (supervisor, admin)
  type: NotificationType;
  title: string;
  body: string;
  relatedItemId?: string; // ID of the task, expense, leave request, etc.
  relatedItemType?: RelatedItemType; // To help UI know what 'relatedItemId' refers to
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

export interface SystemSettings {
  id: string;
  companyName: string;
  companyLogoUrl?: string | null;
  updatedAt: Timestamp | string;
}

// ----- END INVOICING TYPES -----
// ----- END PAYROLL MODULE TYPES -----
