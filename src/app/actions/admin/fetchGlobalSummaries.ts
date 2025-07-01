
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { TaskStatus, AttendanceReviewStatus } from '@/types/database';

export interface GlobalTaskCompletionSummary {
  totalTasks: number;
  completedTasks: number;
  verifiedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  needsReviewTasks: number;
  rejectedTasks: number;
  completionPercentage: number;
}

export interface GlobalAttendanceSummary {
  totalLogs: number;
  checkedIn: number;
  checkedOut: number;
  pendingReview: number;
  approved: number;
  rejected: number;
}

export async function fetchGlobalTaskCompletionSummary(): Promise<GlobalTaskCompletionSummary> {
  const tasksRef = collection(db, 'tasks');
  const snapshot = await getDocs(tasksRef);

  let total = 0,
    completed = 0,
    verified = 0,
    inProgress = 0,
    pending = 0,
    needsReview = 0,
    rejected = 0;

  snapshot.forEach(docSnap => {
    total += 1;
    const status = docSnap.data().status as TaskStatus;
    switch (status) {
      case 'completed':
        completed += 1;
        break;
      case 'verified':
        verified += 1;
        break;
      case 'in-progress':
        inProgress += 1;
        break;
      case 'pending':
        pending += 1;
        break;
      case 'needs-review':
        needsReview += 1;
        break;
      case 'rejected':
        rejected += 1;
        break;
    }
  });

  const completionCount = completed + verified;
  const percentage = total > 0 ? (completionCount / total) * 100 : 0;

  return {
    totalTasks: total,
    completedTasks: completed,
    verifiedTasks: verified,
    inProgressTasks: inProgress,
    pendingTasks: pending,
    needsReviewTasks: needsReview,
    rejectedTasks: rejected,
    completionPercentage: parseFloat(percentage.toFixed(1)),
  };
}

export async function fetchGlobalAttendanceSummary(): Promise<GlobalAttendanceSummary> {
  const attendanceRef = collection(db, 'attendanceLogs');
  const snapshot = await getDocs(attendanceRef);

  let total = 0,
    checkedIn = 0,
    checkedOut = 0,
    pendingReview = 0,
    approved = 0,
    rejected = 0;

  snapshot.forEach(docSnap => {
    total += 1;
    const data = docSnap.data();
    if (data.checkOutTime) {
      checkedOut += 1;
    } else if (data.checkInTime) {
      checkedIn += 1;
    }

    const status = (data.reviewStatus || 'pending') as AttendanceReviewStatus;
    switch (status) {
      case 'approved':
        approved += 1;
        break;
      case 'rejected':
        rejected += 1;
        break;
      default:
        pendingReview += 1;
        break;
    }
  });

  return {
    totalLogs: total,
    checkedIn,
    checkedOut,
    pendingReview,
    approved,
    rejected,
  };
}
