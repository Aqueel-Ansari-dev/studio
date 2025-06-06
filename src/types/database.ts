
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
  createdAt?: string; // ISO string of user creation
}

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
  createdAt?: string; // ISO date string or Timestamp
  createdBy?: string; // UID of the admin who created the project
  dueDate?: string | Timestamp | null; // Optional: ISO date string or Timestamp for project deadline
  budget?: number | null; // Total budget for the project
  materialCost?: number | null;
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

  createdBy: string;
  supervisorNotes?: string;

  employeeNotes?: string;
  submittedMediaUri?: string;

  aiComplianceNotes?: string;
  aiRisks?: string[];

  supervisorReviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Timestamp | number | null; // Firestore Timestamp or millis
}

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
  hoursWorked: number; // Renamed from totalHours
  hourlyRate: number; // Rate used for this calculation if applicable
  taskPay: number;
  approvedExpenses: number; // Renamed from approvedExpenseAmount
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
  reviewedBy?: string;
  reviewedAt?: Timestamp | string;
  createdAt: Timestamp | string;
}
// ----- END PAYROLL MODULE TYPES -----
