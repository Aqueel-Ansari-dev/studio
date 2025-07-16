
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
  arrayUnion,
} from 'firebase/firestore';
import type { Issue, IssueSeverity, IssueStatus, Task, UserRole, Comment } from '@/types/database';
import { getOrganizationId } from '../common/getOrganizationId';
import { createNotificationsForRole, createSingleNotification, getUserDisplayName } from '../notificationsUtils';

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
    const newIssueData: Omit<Issue, 'id' | 'createdAt' | 'updatedAt'> = {
      organizationId,
      projectId,
      taskId: taskId || '',
      title,
      description,
      severity,
      status: 'Open',
      reportedBy: actorId,
      comments: [],
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
      ...(mediaUrl && { mediaUrl }),
      ...(location && { location }),
    };

    const docRef = await addDoc(collection(db, 'organizations', organizationId, 'issues'), newIssueData);

    // Notify admins and supervisors about the new issue
    const actorName = actorDoc.data()?.displayName || 'A user';
    const notifTitle = `New Issue Reported: ${title}`;
    const notifBody = `${actorName} reported a new issue with severity "${severity}".`;
    await createNotificationsForRole('admin', organizationId, 'issue-reported', notifTitle, notifBody, docRef.id, 'issue', actorId, 'general', 'high');
    await createNotificationsForRole('supervisor', organizationId, 'issue-reported', notifTitle, notifBody, docRef.id, 'issue', actorId, 'general', 'high');


    return { success: true, message: 'Issue reported successfully!', issueId: docRef.id };
  } catch (error) {
    console.error('Error reporting issue:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to report issue: ${errorMessage}` };
  }
}

// --- Update Issue ---
const UpdateIssueSchema = z.object({
  issueId: z.string().min(1),
  status: z.enum(['Open', 'In Progress', 'Resolved', 'Closed']).optional(),
  assignedTo: z.string().optional(),
  isEscalated: z.boolean().optional(),
});

export type UpdateIssueInput = z.infer<typeof UpdateIssueSchema>;

export interface UpdateIssueResult {
  success: boolean;
  message: string;
  errors?: z.ZodIssue[];
}

export async function updateIssue(actorId: string, data: UpdateIssueInput): Promise<UpdateIssueResult> {
  const organizationId = await getOrganizationId(actorId);
  if (!organizationId) {
    return { success: false, message: 'Could not determine organization.' };
  }
  
  const actorDoc = await getDoc(doc(db, 'organizations', organizationId, 'users', actorId));
  if (!actorDoc.exists() || !['supervisor', 'admin'].includes(actorDoc.data()?.role)) {
      return { success: false, message: 'You are not authorized to update issues.' };
  }

  const validation = UpdateIssueSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: 'Invalid input data.', errors: validation.error.issues };
  }
  
  const { issueId, ...updates } = validation.data;
  
  try {
    const issueRef = doc(db, 'organizations', organizationId, 'issues', issueId);
    const issueSnap = await getDoc(issueRef);
    if (!issueSnap.exists()) {
        return { success: false, message: "Issue not found." };
    }
    const issueData = issueSnap.data() as Issue;
    
    const dbUpdates: Partial<Omit<Issue, 'id'>> = {
        updatedAt: serverTimestamp() as Timestamp,
    };
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.assignedTo) dbUpdates.assignedTo = updates.assignedTo;
    if (updates.isEscalated !== undefined) dbUpdates.isEscalated = updates.isEscalated;
    
    if (updates.status && (updates.status === 'Resolved' || updates.status === 'Closed')) {
        dbUpdates.resolvedAt = serverTimestamp() as Timestamp;
    }
    
    await updateDoc(issueRef, dbUpdates);
    
    // --- Notifications ---
    const actorName = await getUserDisplayName(actorId, organizationId);
    if(updates.status && updates.status !== issueData.status) {
        await createSingleNotification(issueData.reportedBy, organizationId, 'issue-status-changed', `Issue Status Updated: ${issueData.title}`, `The status of your reported issue has been changed to "${updates.status}" by ${actorName}.`, issueId, 'issue');
    }
    if(updates.assignedTo && updates.assignedTo !== issueData.assignedTo) {
        const assigneeName = await getUserDisplayName(updates.assignedTo, organizationId);
        await createSingleNotification(updates.assignedTo, organizationId, 'issue-assigned', `You have been assigned an issue: ${issueData.title}`, `This issue was assigned to you by ${actorName}.`, issueId, 'issue', 'high');
    }
    
    return { success: true, message: `Issue updated successfully.` };
  } catch (error) {
    console.error('Error updating issue status:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to update status: ${errorMessage}` };
  }
}

// --- Add Comment to Issue ---
const AddCommentSchema = z.object({
  issueId: z.string().min(1),
  content: z.string().min(1, 'Comment cannot be empty.'),
});

export async function addCommentToIssue(actorId: string, data: z.infer<typeof AddCommentSchema>): Promise<{ success: boolean; message: string; comment?: Comment;}> {
    const organizationId = await getOrganizationId(actorId);
    if (!organizationId) {
        return { success: false, message: "Could not determine organization." };
    }
    const validation = AddCommentSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, message: "Invalid comment data." };
    }
    const { issueId, content } = validation.data;
    
    try {
        const issueRef = doc(db, 'organizations', organizationId, 'issues', issueId);
        const issueSnap = await getDoc(issueRef);
        if(!issueSnap.exists()) return { success: false, message: "Issue not found." };
        const issueData = issueSnap.data() as Issue;

        const newComment: Comment = {
            authorId: actorId,
            content,
            createdAt: serverTimestamp() as Timestamp
        };
        await updateDoc(issueRef, {
            comments: arrayUnion(newComment)
        });

        // Notify relevant parties
        const actorName = await getUserDisplayName(actorId, organizationId);
        const notificationTitle = `New Comment on Issue: ${issueData.title}`;
        const notificationBody = `${actorName} commented: "${content.substring(0, 50)}..."`;
        
        const recipients = new Set<string>();
        if(issueData.reportedBy !== actorId) recipients.add(issueData.reportedBy);
        if(issueData.assignedTo && issueData.assignedTo !== actorId) recipients.add(issueData.assignedTo);
        
        for (const recipientId of recipients) {
            await createSingleNotification(recipientId, organizationId, 'issue-comment-added', notificationTitle, notificationBody, issueId, 'issue');
        }

        return { success: true, message: "Comment added.", comment: { ...newComment, createdAt: new Date().toISOString() } };
    } catch (error) {
        console.error("Error adding comment:", error);
        return { success: false, message: "Failed to add comment." };
    }
}


// --- Fetch Issues ---
export interface FetchIssuesFilters {
    projectId?: string;
    status?: IssueStatus;
    severity?: IssueSeverity;
    assignedTo?: string;
}

export async function fetchIssues(actorId: string, filters: FetchIssuesFilters): Promise<{ success: boolean; issues?: Issue[]; error?: string; }> {
    const organizationId = await getOrganizationId(actorId);
    if (!organizationId) {
        return { success: false, error: 'Could not determine organization.' };
    }
    
    try {
        const issuesCollectionRef = collection(db, 'organizations', organizationId, 'issues');
        const queryConstraints = [];

        if (filters.projectId && filters.projectId !== 'all') queryConstraints.push(where('projectId', '==', filters.projectId));
        if (filters.status && filters.status !== 'all') queryConstraints.push(where('status', '==', filters.status));
        if (filters.severity && filters.severity !== 'all') queryConstraints.push(where('severity', '==', filters.severity));
        if (filters.assignedTo && filters.assignedTo !== 'all') queryConstraints.push(where('assignedTo', '==', filters.assignedTo));

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
                comments: (data.comments || []).map((c: any) => ({
                    ...c,
                    createdAt: (c.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString()
                })),
            } as Issue;
        });
        
        return { success: true, issues };
    } catch (error) {
        console.error('Error fetching issues:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        if (errorMessage.includes('firestore/failed-precondition')) {
          return { success: false, error: 'A Firestore index is required for this query. Please check server logs.' };
        }
        return { success: false, error: `Failed to fetch issues: ${errorMessage}` };
    }
}
