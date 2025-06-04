
// Defines the core data structures for the FieldOps MVP application.

/**
 * Defines the possible roles a user can have within the system.
 */
export type UserRole = 'employee' | 'supervisor' | 'admin';

/**
 * Represents an employee user in the system.
 */
export interface Employee {
  id: string; // Firebase UID or other unique identifier
  email: string;
  role: UserRole;
  displayName?: string | null;
  photoURL?: string | null;
  assignedProjectIds?: string[]; // IDs of projects assigned to this employee
  // Add other employee-specific fields as needed, e.g., phone number, teamId
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
}

/**
 * Defines the possible statuses a task can have.
 */
export type TaskStatus =
  | 'pending'       // Task is assigned but not yet started
  | 'in-progress'   // Task is actively being worked on
  | 'paused'        // Task work is temporarily stopped
  | 'completed'     // Task is finished by the employee, awaiting verification/AI check
  | 'compliance-check' // Task is submitted and undergoing AI compliance review
  | 'needs-review'  // Task requires supervisor attention (e.g., AI flagged issue, or manual review requested)
  | 'verified'      // Task is completed and compliance/supervisor review is done
  | 'rejected';     // Task completion was rejected, may need rework

/**
 * Represents a task assigned to an employee within a project.
 */
export interface Task {
  id: string; // Unique identifier for the task
  projectId: string; // Foreign key linking to the Project
  assignedEmployeeId: string; // Foreign key linking to the Employee
  name: string; // This field was named taskName in some places, standardizing to 'name' for consistency with Project
  taskName: string; // Keeping taskName for now due to existing usage, should consolidate later
  description: string;
  status: TaskStatus;
  dueDate?: string | Date; // Expected completion date
  startTime?: number; // Timestamp (milliseconds since epoch) when task moved to 'in-progress'
  endTime?: number; // Timestamp when task was marked 'completed' or 'verified'
  elapsedTime?: number; // Duration in seconds, can be calculated or stored
  createdAt: string | Date; // Timestamp of task creation
  updatedAt: string | Date; // Timestamp of last task update
  supervisorNotes?: string; // Notes from supervisor when assigning or reviewing
  employeeNotes?: string; // Notes from employee upon completion
  // Add other task-specific fields, e.g., priority, dependencies
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
  // Add other attendance-specific fields, e.g., deviceId, ipAddress
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
  // Add other media-specific fields, e.g., thumbnailURL, duration for video
}
