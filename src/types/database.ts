
// Defines the core data structures for the FieldOps MVP application.

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
  createdAt?: string; // ISO date string
  createdBy?: string; // UID of the admin who created the project
  dueDate?: string | null; // Optional: ISO date string for project deadline
  budget?: number | null; // Total budget for the project
  materialCost?: number | null; // Cost of materials for the project (This might be deprecated if projectInventory is fully used)
}

/**
 * Defines the possible statuses a task can have.
 */
export type TaskStatus =
  | 'pending'       // Task is assigned but not yet started
  | 'in-progress'   // Task is actively being worked on
  | 'paused'        // Task work is temporarily stopped
  | 'completed'     // Task is finished by the employee, AI check passed/not required
  | 'needs-review'  // Task requires supervisor attention (e.g., AI flagged issue or manual review policy)
  | 'verified'      // Task is completed and reviewed/approved by supervisor
  | 'rejected';     // Task completion was rejected by supervisor

/**
 * Represents a task assigned to an employee within a project.
 */
export interface Task {
  id: string; // Unique identifier for the task
  projectId: string; // Foreign key linking to the Project
  assignedEmployeeId: string; // Foreign key linking to the Employee
  taskName: string;
  description: string;
  status: TaskStatus;
  dueDate?: string; // Expected completion date (ISO string)

  startTime?: number; // Timestamp (milliseconds since epoch) when task moved to 'in-progress'
  endTime?: number; // Timestamp (milliseconds since epoch) when task was completed/verified by employee action
  elapsedTime?: number; // Duration in seconds, should be calculated and stored when task ends

  createdAt: string; // ISO string from Firestore serverTimestamp
  updatedAt: string; // ISO string from Firestore serverTimestamp

  createdBy: string; // UID of supervisor who created/assigned the task
  supervisorNotes?: string; // Notes from supervisor when assigning the task

  employeeNotes?: string; // Notes from employee upon completion
  submittedMediaUri?: string; // Data URI of submitted media (temporary solution for MVP)

  aiComplianceNotes?: string; // Notes or information requested by AI during compliance check
  aiRisks?: string[]; // List of compliance risks identified by AI

  supervisorReviewNotes?: string; // Notes from supervisor during the review process (approval/rejection)
  reviewedBy?: string; // UID of supervisor who reviewed the task
  reviewedAt?: number; // Timestamp (milliseconds since epoch) of when the review action was taken
}

/**
 * Represents an attendance record for an employee.
 */
export interface Attendance {
  id: string; // Unique identifier for the attendance record
  employeeId: string; // Foreign key linking to the Employee
  taskId?: string; // Optional: if attendance is directly tied to starting a specific task
  checkInTime: string | Date; // Timestamp of check-in
  checkOutTime?: string | Date; // Optional: Timestamp of check-out, might not be used if solely task-based
  gpsCoordinates?: { // Optional: if GPS verification is part of check-in/out
    latitude: number;
    longitude: number;
    accuracy?: number; // GPS accuracy in meters
    timestamp?: number; // Timestamp of GPS fix
  };
  verified?: boolean; // Flag indicating if GPS location was successfully verified (e.g., within geofence)
}

/**
 * Represents media (image, video, or text note) attached to a task.
 */
export interface TaskMedia {
  id: string; // Unique identifier for the media item
  taskId: string; // Foreign key linking to the Task
  employeeId: string; // Foreign key for the employee who uploaded/created
  type: 'image' | 'video' | 'note'; // Type of media
  urlOrContent: string; // URL for stored image/video, or the text content for a note
  fileName?: string; // Original file name, if applicable
  mimeType?: string; // MIME type for files, e.g., 'image/jpeg', 'video/mp4'
  size?: number; // File size in bytes, if applicable
  uploadedAt: string | Date; // Timestamp of upload/creation
}

/**
 * Represents an item in the project inventory.
 * Stored in 'projectInventory' collection.
 */
export interface InventoryItem {
  id: string; // Auto-generated Firestore document ID
  projectId: string; // Foreign key linking to the Project
  itemName: string;
  quantity: number;
  unit: 'kg' | 'pcs' | 'm' | 'liters' | 'custom';
  costPerUnit: number;
  createdBy: string; // UID of the supervisor or admin who added the item
  createdAt: string; // ISO string from Firestore serverTimestamp
  customUnitLabel?: string; // Optional: if unit is 'custom', provide a label
}

/**
 * Represents an expense logged by an employee.
 * Stored in 'employeeExpenses' collection.
 */
export interface EmployeeExpense {
  id: string; // Auto-generated Firestore document ID
  employeeId: string; // Foreign key linking to the Employee
  projectId: string; // Foreign key linking to the Project
  type: 'travel' | 'food' | 'tools' | 'other';
  amount: number;
  notes: string; // Optional notes about the expense
  receiptImageUri?: string; // Optional: Data URI or URL of the receipt image
  createdAt: string; // ISO string from Firestore serverTimestamp
  approved: boolean; // Default false, set to true by supervisor/admin
  approvedBy?: string; // UID of supervisor/admin who approved
  approvedAt?: string; // ISO string timestamp of approval
  rejectionReason?: string; // If rejected, the reason
}

