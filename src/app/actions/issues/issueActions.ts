
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  startAfter,
  Timestamp,
} from 'firebase/firestore';
import type { Issue, IssueSeverity, IssueStatus, Task, UserRole } from '@/types/database';
import { getOrganizationId } from '../common/getOrganizationId';

// --- Report Issue ---
const ReportIssueSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  taskId: z.string().optional(),
  title: z.string().min(5, 'Title must be at least 5 characters.').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters.').max(1000),
  severity: z.enum(['Low', 'Medium', 'High', 'Critical']),
  mediaUrl: z.string().url().optional(),
  location: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

export type ReportIssueInput = z.infer<typeof ReportIssueSchema>;

export interface ReportIssueResult {
  success: boolean;
  message: string;
  issueId?: string;
  errors?: z.ZodIssue[];
}

export async function reportIssue(actorId: string, data: ReportIssueInput): Promise<ReportIssueResult> {
  const organizationId = await getOrganizationId(actorId);
  if (!organizationId) {
    return { success: false, message: 'Could not determine organization for user.' };
  }
  
  // Explicitly check for allowed roles to report an issue.
  const actorDoc = await getDoc(doc(db, 'organizations', organizationId, 'users', actorId));
  if (!actorDoc.exists() || !['employee', 'supervisor', 'admin'].includes(actorDoc.data()?.role)) {
      return { success: false, message: 'You are not authorized to report issues.' };
  }

  const validation = ReportIssueSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: 'Invalid input data.', errors: validation.error.issues };
  }

  const { projectId, taskId, title, description, severity, mediaUrl, location } = validation.data;

  try {
    const newIssueData: Omit<Issue, 'id'> = {
      organizationId,
      projectId,
      taskId: taskId || '',
      title,
      description,
      severity,
      status: 'Open',
      reportedBy: actorId,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
      ...(mediaUrl && { mediaUrl }),
      ...(location && { location }),
    };

    const docRef = await addDoc(collection(db, 'organizations', organizationId, 'issues'), newIssueData);

    // TODO: Add notification logic here to inform supervisors/admins

    return { success: true, message: 'Issue reported successfully!', issueId: docRef.id };
  } catch (error) {
    console.error('Error reporting issue:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to report issue: ${errorMessage}` };
  }
}

// --- Update Issue Status ---
const UpdateIssueStatusSchema = z.object({
  issueId: z.string().min(1),
  status: z.enum(['Open', 'In Progress', 'Resolved', 'Closed']),
  isEscalated: z.boolean().optional(),
});

export type UpdateIssueStatusInput = z.infer<typeof UpdateIssueStatusSchema>;

export interface UpdateIssueStatusResult {
  success: boolean;
  message: string;
  errors?: z.ZodIssue[];
}

export async function updateIssueStatus(actorId: string, data: UpdateIssueStatusInput): Promise<UpdateIssueStatusResult> {
  const organizationId = await getOrganizationId(actorId);
  if (!organizationId) {
    return { success: false, message: 'Could not determine organization.' };
  }
  
  // Basic role check - a more robust permission system might be needed
  const actorDoc = await getDoc(doc(db, 'organizations', organizationId, 'users', actorId));
  if (!actorDoc.exists() || !['supervisor', 'admin'].includes(actorDoc.data()?.role)) {
      return { success: false, message: 'You are not authorized to update issue statuses.' };
  }

  const validation = UpdateIssueStatusSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: 'Invalid input data.', errors: validation.error.issues };
  }
  
  const { issueId, status, isEscalated } = validation.data;
  
  try {
    const issueRef = doc(db, 'organizations', organizationId, 'issues', issueId);
    
    const updates: Partial<Omit<Issue, 'id'>> = {
        status,
        updatedAt: serverTimestamp() as Timestamp,
    };
    if (status === 'Resolved' || status === 'Closed') {
        updates.resolvedAt = serverTimestamp() as Timestamp;
    }
    if (isEscalated !== undefined) {
        updates.isEscalated = isEscalated;
    }
    
    await updateDoc(issueRef, updates);
    
    // TODO: Add notification and audit log logic
    
    return { success: true, message: `Issue status updated to "${status}".` };
  } catch (error) {
    console.error('Error updating issue status:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to update status: ${errorMessage}` };
  }
}

// --- Fetch Issues ---
export interface FetchIssuesFilters {
    projectId?: string;
    status?: IssueStatus;
    severity?: IssueSeverity;
}

export async function fetchIssues(actorId: string, filters: FetchIssuesFilters): Promise<{ success: boolean; issues?: Issue[]; error?: string; }> {
    const organizationId = await getOrganizationId(actorId);
    if (!organizationId) {
        return { success: false, error: 'Could not determine organization.' };
    }
    
    try {
        const issuesCollectionRef = collection(db, 'organizations', organizationId, 'issues');
        const queryConstraints = [];

        if (filters.projectId) queryConstraints.push(where('projectId', '==', filters.projectId));
        if (filters.status) queryConstraints.push(where('status', '==', filters.status));
        if (filters.severity) queryConstraints.push(where('severity', '==', filters.severity));

        queryConstraints.push(orderBy('createdAt', 'desc'));

        const q = query(issuesCollectionRef, ...queryConstraints);
        const snapshot = await getDocs(q);

        const issues = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
                updatedAt: (data.updatedAt as Timestamp).toDate().toISOString(),
                ...(data.resolvedAt && { resolvedAt: (data.resolvedAt as Timestamp).toDate().toISOString() }),
            } as Issue;
        });
        
        return { success: true, issues };
    } catch (error) {
        console.error('Error fetching issues:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        return { success: false, error: `Failed to fetch issues: ${errorMessage}` };
    }
}
