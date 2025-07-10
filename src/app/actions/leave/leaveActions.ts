

'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  orderBy
} from 'firebase/firestore';
import type { LeaveRequest, UserRole } from '@/types/database';
import { createNotificationsForRole, getUserDisplayName, getProjectName } from '@/app/actions/notificationsUtils';
import { notifyRoleByWhatsApp } from '@/lib/notify';
import { format, differenceInBusinessDays, startOfYear, endOfYear } from 'date-fns';
import { getSystemSettings } from '@/app/actions/admin/systemSettings';
import { getOrganizationId } from '../common/getOrganizationId';


// Schema for requesting leave
const LeaveRequestSchema = z.object({
  projectId: z.string().optional(),
  fromDate: z.date(),
  toDate: z.date(),
  leaveType: z.enum(['sick', 'casual', 'unpaid']),
  reason: z.string().max(500)
});

export type RequestLeaveInput = z.infer<typeof LeaveRequestSchema>;

export interface RequestLeaveResult {
  success: boolean;
  message: string;
  requestId?: string;
  errors?: z.ZodIssue[];
}

async function verifyRole(userId: string, roles: UserRole[]): Promise<boolean> {
  const organizationId = await getOrganizationId(userId);
  if (!userId || !organizationId) return false;
  const userDoc = await getDoc(doc(db, 'organizations', organizationId, 'users', userId));
  if (!userDoc.exists()) return false;
  const userRole = userDoc.data()?.role as UserRole;
  return roles.includes(userRole);
}

export async function requestLeave(employeeId: string, data: RequestLeaveInput): Promise<RequestLeaveResult> {
  const organizationId = await getOrganizationId(employeeId);
  if (!organizationId) {
    return { success: false, message: 'Could not determine organization for user.' };
  }
  
  const validation = LeaveRequestSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: 'Invalid input.', errors: validation.error.issues };
  }
  const { projectId: validatedProjectId, fromDate, toDate, leaveType, reason } = validation.data;
  try {
    const leaveRequestsCollectionRef = collection(db, 'organizations', organizationId, 'leaveRequests');
    const newRequestPayload: {
      employeeId: string;
      fromDate: Timestamp;
      toDate: Timestamp;
      leaveType: 'sick' | 'casual' | 'unpaid';
      reason: string;
      status: 'pending';
      createdAt: any; 
      projectId?: string; 
    } = {
      employeeId,
      fromDate: Timestamp.fromDate(fromDate),
      toDate: Timestamp.fromDate(toDate),
      leaveType,
      reason,
      status: 'pending',
      createdAt: serverTimestamp(),
    };

    if (validatedProjectId && validatedProjectId.trim() !== '') {
      newRequestPayload.projectId = validatedProjectId;
    }

    const docRef = await addDoc(leaveRequestsCollectionRef, newRequestPayload);

    // Notifications
    const employeeName = await getUserDisplayName(employeeId, organizationId);
    const projectName = validatedProjectId ? await getProjectName(validatedProjectId, organizationId) : 'N/A';
    const fromDateStr = format(fromDate, 'PP');
    const toDateStr = format(toDate, 'PP');
    const title = `Leave Request: ${employeeName}`;
    const body = `${employeeName} requested ${leaveType} leave from ${fromDateStr} to ${toDateStr} ${validatedProjectId ? `for project "${projectName}"` : ''}. Reason: ${reason.substring(0, 100)}${reason.length > 100 ? '...' : ''}`;

    await createNotificationsForRole(
      'supervisor',
      organizationId,
      'leave-requested',
      title,
      body,
      docRef.id,
      'leave_request',
      undefined,
      'attendance',
      'normal'
    );
    await createNotificationsForRole(
      'admin',
      organizationId,
      'leave-requested',
      `Admin: ${title}`,
      body,
      docRef.id,
      'leave_request',
      undefined,
      'attendance',
      'normal'
    );

    const waMsg = `\ud83d\udcdd Leave Request\nEmployee: ${employeeName}\nFrom: ${fromDateStr} To: ${toDateStr}${validatedProjectId ? `\nProject: ${projectName}` : ''}`;
    await notifyRoleByWhatsApp(organizationId, 'supervisor', waMsg, employeeId);
    await notifyRoleByWhatsApp(organizationId, 'admin', waMsg, employeeId);

    return { success: true, message: 'Leave request submitted.', requestId: docRef.id };
  } catch (error) {
    console.error('Error submitting leave request:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to submit leave request: ${message}` };
  }
}

export interface ReviewLeaveResult {
  success: boolean;
  message: string;
}

export async function reviewLeaveRequest(reviewerId: string, requestId: string, action: 'approve' | 'reject'): Promise<ReviewLeaveResult> {
  const organizationId = await getOrganizationId(reviewerId);
  if (!organizationId) {
    return { success: false, message: 'Could not determine organization for reviewer.' };
  }
  
  const authorized = await verifyRole(reviewerId, ['admin', 'supervisor']);
  if (!authorized) return { success: false, message: 'Unauthorized reviewer.' };
  if (!requestId) return { success: false, message: 'Leave request ID is required.' };
  try {
    const reqRef = doc(db, 'organizations', organizationId, 'leaveRequests', requestId);
    const snap = await getDoc(reqRef);
    if (!snap.exists()) return { success: false, message: 'Leave request not found.' };
    
    const leaveData = snap.data() as LeaveRequest;
    const status = action === 'approve' ? 'approved' : 'rejected';
    
    await updateDoc(reqRef, {
      status,
      reviewedBy: reviewerId,
      reviewedAt: serverTimestamp()
    });

    // Admin Notification
    const employeeName = await getUserDisplayName(leaveData.employeeId, organizationId);
    const reviewerName = await getUserDisplayName(reviewerId, organizationId);
    const title = `Leave ${action === 'approve' ? 'Approved' : 'Rejected'}: ${employeeName}`;
    const body = `Leave request for ${employeeName} was ${status} by ${reviewerName}.`;
    await createNotificationsForRole(
      'admin',
      organizationId,
      action === 'approve' ? 'leave-approved-by-supervisor' : 'leave-rejected-by-supervisor',
      title,
      body,
      requestId,
      'leave_request',
      reviewerId,
      'attendance',
      action === 'approve' ? 'normal' : 'high'
    );


    return { success: true, message: `Leave request ${status}.` };
  } catch (error) {
    console.error('Error reviewing leave request:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to update leave request: ${message}` };
  }
}

function convertLeaveDoc(docSnap: any): LeaveRequest {
  const data = docSnap.data();
  const toIso = (ts?: Timestamp) => ts ? ts.toDate().toISOString() : undefined;
  return {
    id: docSnap.id,
    employeeId: data.employeeId,
    projectId: data.projectId, 
    fromDate: toIso(data.fromDate)!,
    toDate: toIso(data.toDate)!,
    leaveType: data.leaveType,
    reason: data.reason,
    status: data.status,
    reviewedBy: data.reviewedBy,
    reviewedAt: toIso(data.reviewedAt),
    createdAt: toIso(data.createdAt)!
  } as LeaveRequest;
}

export async function getLeaveRequests(employeeId: string): Promise<LeaveRequest[] | { error: string }> {
  const organizationId = await getOrganizationId(employeeId);
  if (!organizationId) {
    return { error: 'Could not determine organization for user.' };
  }
  
  if (!employeeId) return { error: 'Employee ID is required.' };
  try {
    const q = query(
      collection(db, 'organizations', organizationId, 'leaveRequests'),
      where('employeeId', '==', employeeId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(convertLeaveDoc);
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (message.includes('firestore/failed-precondition') && message.includes('requires an index')) {
         return { error: `Query requires a Firestore index. Please check server logs for details. Message: ${message}` };
    }
    return { error: `Failed to fetch leave requests: ${message}` };
  }
}

export async function getLeaveRequestsForReview(adminId: string): Promise<LeaveRequest[] | { error: string }> {
  const organizationId = await getOrganizationId(adminId);
  if (!organizationId) {
    return { error: 'Could not determine organization for reviewer.' };
  }
  const authorized = await verifyRole(adminId, ['admin', 'supervisor']);
  if (!authorized) return { error: 'Unauthorized.' };
  try {
    const q = query(collection(db, 'organizations', organizationId, 'leaveRequests'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(convertLeaveDoc);
  } catch (error) {
    console.error('Error fetching leave requests for review:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
     if (message.includes('firestore/failed-precondition') && message.includes('requires an index')) {
         return { error: `Query requires a Firestore index. Please check server logs for details. Message: ${message}` };
    }
    return { error: `Failed to fetch leave requests: ${message}` };
  }
}

export interface LeaveBalance {
    totalPaidLeaves: number;
    approvedPaidLeavesTaken: number;
    pendingPaidLeaves: number;
    remainingPaidLeaves: number;
}

export async function getLeaveBalance(employeeId: string): Promise<{ success: boolean; balance?: LeaveBalance; error?: string }> {
    const organizationId = await getOrganizationId(employeeId);
    if (!organizationId) {
        return { success: false, error: 'Could not determine organization for user.' };
    }

    try {
        const settingsResult = await getSystemSettings(employeeId);
        const totalPaidLeaves = settingsResult.settings?.paidLeaves ?? 0;

        const yearStart = startOfYear(new Date());
        const yearEnd = endOfYear(new Date());

        const q = query(
            collection(db, 'organizations', organizationId, 'leaveRequests'),
            where('employeeId', '==', employeeId),
            where('fromDate', '>=', Timestamp.fromDate(yearStart)),
            where('fromDate', '<=', Timestamp.fromDate(yearEnd))
        );

        const querySnapshot = await getDocs(q);
        const requests = querySnapshot.docs.map(doc => doc.data() as Omit<LeaveRequest, 'id'>);

        let approvedPaidLeavesTaken = 0;
        let pendingPaidLeaves = 0;

        requests.forEach(req => {
            if (req.leaveType === 'sick' || req.leaveType === 'casual') {
                const fromDate = (req.fromDate as Timestamp).toDate();
                const toDate = (req.toDate as Timestamp).toDate();
                const days = differenceInBusinessDays(toDate, fromDate) + 1;

                if (req.status === 'approved') {
                    approvedPaidLeavesTaken += days;
                } else if (req.status === 'pending') {
                    pendingPaidLeaves += days;
                }
            }
        });
        
        const balance: LeaveBalance = {
            totalPaidLeaves,
            approvedPaidLeavesTaken,
            pendingPaidLeaves,
            remainingPaidLeaves: totalPaidLeaves - approvedPaidLeavesTaken,
        };
        
        return { success: true, balance };

    } catch (error) {
        console.error('Error fetching leave balance:', error);
        const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
         if (message.includes('firestore/failed-precondition') && message.includes('requires an index')) {
             return { success: false, error: `Query requires a Firestore index. Check logs for details. Message: ${message}` };
        }
        return { success: false, error: `Failed to fetch leave balance: ${message}` };
    }
}
    
