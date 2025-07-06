
'use server';
import { db } from '@/lib/firebase';
import { collection, getCountFromServer, query, where, Timestamp, AggregateQuerySnapshot, AggregateField } from 'firebase/firestore';
import { format } from 'date-fns';

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
  todaysCheckIns: AdminDashboardStat;
  todaysCheckOuts: AdminDashboardStat;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  // Helper to safely get count from a settled promise
  const getCount = (result: PromiseSettledResult<AggregateQuerySnapshot<{ count: AggregateField<number> }>>, queryName: string): number => {
    if (result.status === 'fulfilled') {
      return result.value.data().count;
    }
    console.error(`Error fetching count for '${queryName}':`, result.reason);
    // Use -1 to indicate an error state that can be handled later
    return -1; 
  };
  
  // Helper to create the final stat object, handling error states
  const createStat = (value: number, delta: number, description: string, deltaType: 'increase' | 'decrease' | 'neutral' = 'increase'): AdminDashboardStat => {
    if (value === -1 || delta === -1) {
      let errorDescription = 'Error loading data. Check server logs for details.';
      // A more specific error message if it's likely an index issue
      if (value === -1) {
          errorDescription = 'Error loading stat. A Firestore index is likely required. Please check server logs for a link to create it.';
      } else if (delta === -1) {
          errorDescription = 'Error loading period delta. A Firestore index is likely required. Check server logs.';
      }
      return { value: 0, delta: 0, deltaType: 'neutral', description: errorDescription };
    }
    return { value, delta, deltaType, description };
  };

  try {
    const usersRef = collection(db, 'users');
    const projectsRef = collection(db, 'projects');
    const tasksRef = collection(db, 'tasks');
    const expensesRef = collection(db, 'employeeExpenses');
    const attendanceLogsRef = collection(db, 'attendanceLogs');
    
    const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
    const todayDateString = format(new Date(), 'yyyy-MM-dd');

    const promiseResults = await Promise.allSettled([
      getCountFromServer(usersRef), // 0
      getCountFromServer(query(usersRef, where('createdAt', '>=', sevenDaysAgo))), // 1
      getCountFromServer(projectsRef), // 2
      getCountFromServer(query(projectsRef, where('createdAt', '>=', sevenDaysAgo))), // 3
      getCountFromServer(query(tasksRef, where('status', '==', 'in-progress'))), // 4
      getCountFromServer(query(tasksRef, where('status', '==', 'in-progress'), where('updatedAt', '>=', twentyFourHoursAgo))), // 5
      getCountFromServer(query(tasksRef, where('status', '==', 'needs-review'))), // 6
      getCountFromServer(query(tasksRef, where('status', '==', 'needs-review'), where('updatedAt', '>=', twentyFourHoursAgo))), // 7
      getCountFromServer(query(expensesRef, where('approved', '==', false), where('rejectionReason', '==', null))), // 8
      getCountFromServer(query(expensesRef, where('approved', '==', false), where('rejectionReason', '==', null), where('createdAt', '>=', twentyFourHoursAgo))), // 9
      getCountFromServer(query(attendanceLogsRef, where('date', '==', todayDateString))), // 10
      getCountFromServer(query(attendanceLogsRef, where('date', '==', todayDateString), where('checkOutTime', '!=', null))), // 11
    ]);

    const totalUsersCount = getCount(promiseResults[0], 'totalUsers');
    const newUsersCount = getCount(promiseResults[1], 'newUsers');
    const totalProjectsCount = getCount(promiseResults[2], 'totalProjects');
    const newProjectsCount = getCount(promiseResults[3], 'newProjects');
    const tasksInProgressCount = getCount(promiseResults[4], 'tasksInProgress');
    const newTasksInProgressCount = getCount(promiseResults[5], 'newTasksInProgress');
    const tasksNeedingReviewCount = getCount(promiseResults[6], 'tasksNeedingReview');
    const newTasksNeedingReviewCount = getCount(promiseResults[7], 'newTasksNeedingReview');
    const expensesNeedingReviewCount = getCount(promiseResults[8], 'expensesNeedingReview');
    const newExpensesNeedingReviewCount = getCount(promiseResults[9], 'newExpensesNeedingReview');
    const todaysCheckInsCount = getCount(promiseResults[10], 'todaysCheckIns');
    const todaysCheckOutsCount = getCount(promiseResults[11], 'todaysCheckOuts');

    return {
      totalProjects: createStat(totalProjectsCount, newProjectsCount, 'Total number of active, completed, and inactive projects in the system.'),
      totalUsers: createStat(totalUsersCount, newUsersCount, 'Total number of users with employee, supervisor, or admin roles.'),
      tasksInProgress: createStat(tasksInProgressCount, newTasksInProgressCount, 'Tasks that are currently being worked on by employees.', 'neutral'),
      tasksNeedingReview: createStat(tasksNeedingReviewCount, newTasksNeedingReviewCount, 'Tasks submitted by employees that require supervisor approval.', 'neutral'),
      expensesNeedingReview: createStat(expensesNeedingReviewCount, newExpensesNeedingReviewCount, 'Expense reports submitted by employees that need review.', 'neutral'),
      todaysCheckIns: createStat(todaysCheckInsCount, 0, 'Total employees checked in today.', 'neutral'),
      todaysCheckOuts: createStat(todaysCheckOutsCount, 0, 'Total employees checked out today.', 'neutral'),
    };
  } catch (error) {
    // This top-level catch is now a fallback for unexpected errors, not query failures.
    console.error("A critical error occurred in getAdminDashboardStats:", error);
    const zeroStat = { value: 0, delta: 0, deltaType: 'neutral', description: 'A critical error occurred.' };
    return {
      totalProjects: zeroStat,
      totalUsers: zeroStat,
      tasksInProgress: zeroStat,
      tasksNeedingReview: zeroStat,
      expensesNeedingReview: zeroStat,
      todaysCheckIns: zeroStat,
      todaysCheckOuts: zeroStat,
    };
  }
}
