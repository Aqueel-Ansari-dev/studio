
'use server';
import { db } from '@/lib/firebase';
import { collection, getCountFromServer, query, where, Timestamp } from 'firebase/firestore';

export interface AdminDashboardStat {
  value: number;
  delta: number;
  deltaType: 'increase' | 'decrease' | 'neutral';
  description: string;
}

export interface AdminDashboardStats {
  totalProjects: AdminDashboardStat;
  totalUsers: AdminDashboardStat;
  tasksInProgress: AdminDashboardStat;
  tasksNeedingReview: AdminDashboardStat;
  expensesNeedingReview: AdminDashboardStat;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  try {
    const usersRef = collection(db, 'users');
    const projectsRef = collection(db, 'projects');
    const tasksRef = collection(db, 'tasks');
    const expensesRef = collection(db, 'employeeExpenses');
    
    const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);

    const [
      usersSnap,
      newUsersSnap,
      projectsSnap,
      newProjectsSnap,
      tasksInProgressSnap,
      newTasksInProgressSnap,
      tasksNeedingReviewSnap,
      newTasksNeedingReviewSnap,
      expensesNeedingReviewSnap,
      newExpensesNeedingReviewSnap,
    ] = await Promise.all([
      // Total counts
      getCountFromServer(usersRef),
      getCountFromServer(query(usersRef, where('createdAt', '>=', sevenDaysAgo))),
      getCountFromServer(projectsRef),
      getCountFromServer(query(projectsRef, where('createdAt', '>=', sevenDaysAgo))),
      getCountFromServer(query(tasksRef, where('status', '==', 'in-progress'))),
      getCountFromServer(query(tasksRef, where('status', '==', 'in-progress'), where('updatedAt', '>=', twentyFourHoursAgo))),
      getCountFromServer(query(tasksRef, where('status', '==', 'needs-review'))),
      getCountFromServer(query(tasksRef, where('status', '==', 'needs-review'), where('updatedAt', '>=', twentyFourHoursAgo))),
      getCountFromServer(query(expensesRef, where('approved', '==', false), where('rejectionReason', '==', null))),
      getCountFromServer(query(expensesRef, where('approved', '==', false), where('rejectionReason', '==', null), where('createdAt', '>=', twentyFourHoursAgo))),
    ]);

    return {
      totalProjects: {
        value: projectsSnap.data().count,
        delta: newProjectsSnap.data().count,
        deltaType: 'increase',
        description: 'Total number of active, completed, and inactive projects in the system.',
      },
      totalUsers: {
        value: usersSnap.data().count,
        delta: newUsersSnap.data().count,
        deltaType: 'increase',
        description: 'Total number of users with employee, supervisor, or admin roles.',
      },
      tasksInProgress: {
        value: tasksInProgressSnap.data().count,
        delta: newTasksInProgressSnap.data().count,
        deltaType: 'neutral',
        description: 'Tasks that are currently being worked on by employees.',
      },
      tasksNeedingReview: {
        value: tasksNeedingReviewSnap.data().count,
        delta: newTasksNeedingReviewSnap.data().count,
        deltaType: 'neutral',
        description: 'Tasks submitted by employees that require supervisor approval.',
      },
      expensesNeedingReview: {
        value: expensesNeedingReviewSnap.data().count,
        delta: newExpensesNeedingReviewSnap.data().count,
        deltaType: 'neutral',
        description: 'Expense reports submitted by employees that need review.',
      }
    };
  } catch (error) {
    console.error("Error fetching admin dashboard stats:", error);
    // Return zeroed out stats on error to prevent crashing the page
    const zeroStat = { value: 0, delta: 0, deltaType: 'neutral', description: 'Error loading data.' };
    return {
      totalProjects: zeroStat,
      totalUsers: zeroStat,
      tasksInProgress: zeroStat,
      tasksNeedingReview: zeroStat,
      expensesNeedingReview: zeroStat,
    };
  }
}
