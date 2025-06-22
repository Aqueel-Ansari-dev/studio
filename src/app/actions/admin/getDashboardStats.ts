'use server';
import { db } from '@/lib/firebase';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';

export interface AdminDashboardStats {
  totalUsers: number;
  totalProjects: number;
  tasksInProgress: number;
  tasksNeedingReview: number;
  expensesNeedingReview: number;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  try {
    const usersRef = collection(db, 'users');
    const projectsRef = collection(db, 'projects');
    const tasksRef = collection(db, 'tasks');
    const expensesRef = collection(db, 'employeeExpenses');

    // Note: getCountFromServer reads are billed as one document read per query, regardless of the number of results.
    const [
      usersSnap,
      projectsSnap,
      tasksInProgressSnap,
      tasksNeedingReviewSnap,
      expensesNeedingReviewSnap,
    ] = await Promise.all([
      getCountFromServer(usersRef),
      getCountFromServer(projectsRef),
      getCountFromServer(query(tasksRef, where('status', '==', 'in-progress'))),
      getCountFromServer(query(tasksRef, where('status', '==', 'needs-review'))),
      getCountFromServer(query(expensesRef, where('approved', '==', false), where('rejectionReason', '==', null))),
    ]);

    return {
      totalUsers: usersSnap.data().count,
      totalProjects: projectsSnap.data().count,
      tasksInProgress: tasksInProgressSnap.data().count,
      tasksNeedingReview: tasksNeedingReviewSnap.data().count,
      expensesNeedingReview: expensesNeedingReviewSnap.data().count,
    };
  } catch (error) {
    console.error("Error fetching admin dashboard stats:", error);
    // Return zeroed out stats on error to prevent crashing the page
    return {
      totalUsers: 0,
      totalProjects: 0,
      tasksInProgress: 0,
      tasksNeedingReview: 0,
      expensesNeedingReview: 0,
    };
  }
}
