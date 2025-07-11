
'use server';
import { db } from '@/lib/firebase';
import { collection, getCountFromServer, query, where, Timestamp, AggregateQuerySnapshot, AggregateField, getDocs } from 'firebase/firestore';
import { format, subDays } from 'date-fns';
import { getOrganizationId } from '../common/getOrganizationId';

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

const getEmptyStats = (errorMsg: string = "Data could not be loaded."): AdminDashboardStats => {
    const zeroStat = { value: 0, delta: 0, deltaType: 'neutral', description: errorMsg };
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


export async function getAdminDashboardStats(adminUserId: string): Promise<AdminDashboardStats> {
    const organizationId = await getOrganizationId(adminUserId);
    if (!organizationId) {
        return getEmptyStats("Organization not found.");
    }

  const getCount = (result: PromiseSettledResult<AggregateQuerySnapshot<{ count: AggregateField<number> }>>, queryName: string): number => {
    if (result.status === 'fulfilled') {
      return result.value.data().count;
    }
    console.error(`Error fetching count for '${queryName}':`, result.reason);
    return -1; 
  };
  
  const createStat = (value: number, delta: number, description: string, deltaType: 'increase' | 'decrease' | 'neutral' = 'increase'): AdminDashboardStat => {
    if (value === -1 || delta === -1) {
      let errorDescription = 'Error loading data. Check server logs for details.';
      if (value === -1) errorDescription = 'Error loading stat. A Firestore index is likely required.';
      else if (delta === -1) errorDescription = 'Error loading period delta. A Firestore index is likely required.';
      return { value: 0, delta: 0, deltaType: 'neutral', description: errorDescription };
    }
    return { value, delta, deltaType, description };
  };

  try {
    const usersRef = collection(db, 'organizations', organizationId, 'users');
    const projectsRef = collection(db, 'organizations', organizationId, 'projects');
    const tasksRef = collection(db, 'organizations', organizationId, 'tasks');
    const expensesRef = collection(db, 'organizations', organizationId, 'employeeExpenses');
    const attendanceLogsRef = collection(db, 'organizations', organizationId, 'attendanceLogs');
    
    const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
    const todayDateString = format(new Date(), 'yyyy-MM-dd');

    // To count check-ins and check-outs for both employees and supervisors, we first need to get their UIDs.
    const allRelevantUsersSnap = await getDocs(query(usersRef, where('role', 'in', ['employee', 'supervisor'])));
    const relevantUserIds = allRelevantUsersSnap.docs.map(doc => doc.id);

    // If there are no relevant users, we can skip the attendance queries.
    const hasRelevantUsers = relevantUserIds.length > 0;

    const promiseResults = await Promise.allSettled([
      getCountFromServer(query(projectsRef)), // 0 totalProjects
      getCountFromServer(query(projectsRef, where('createdAt', '>=', sevenDaysAgo))), // 1 newProjects
      getCountFromServer(query(usersRef)), // 2 totalUsers
      getCountFromServer(query(usersRef, where('createdAt', '>=', sevenDaysAgo))), // 3 newUsers
      getCountFromServer(query(tasksRef, where('status', '==', 'in-progress'))), // 4 tasksInProgress
      getCountFromServer(query(tasksRef, where('status', '==', 'in-progress'), where('updatedAt', '>=', twentyFourHoursAgo))), // 5 newTasksInProgress
      getCountFromServer(query(tasksRef, where('status', '==', 'needs-review'))), // 6 tasksNeedingReview
      getCountFromServer(query(tasksRef, where('status', '==', 'needs-review'), where('updatedAt', '>=', twentyFourHoursAgo))), // 7 newTasksNeedingReview
      getCountFromServer(query(expensesRef, where('approved', '==', false), where('rejectionReason', '==', null))), // 8 expensesNeedingReview
      getCountFromServer(query(expensesRef, where('approved', '==', false), where('rejectionReason', '==', null), where('createdAt', '>=', twentyFourHoursAgo))), // 9 newExpensesNeedingReview
      hasRelevantUsers ? getCountFromServer(query(attendanceLogsRef, where('date', '==', todayDateString), where('employeeId', 'in', relevantUserIds))) : Promise.resolve({ data: () => ({ count: 0 }) }), // 10 todaysCheckIns
      hasRelevantUsers ? getCountFromServer(query(attendanceLogsRef, where('date', '==', todayDateString), where('employeeId', 'in', relevantUserIds), where('checkOutTime', '!=', null))) : Promise.resolve({ data: () => ({ count: 0 }) }), // 11 todaysCheckOuts
    ]);

    const totalProjectsCount = getCount(promiseResults[0], 'totalProjects');
    const newProjectsCount = getCount(promiseResults[1], 'newProjects');
    const totalUsersCount = getCount(promiseResults[2], 'totalUsers');
    const newUsersCount = getCount(promiseResults[3], 'newUsers');
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
    console.error("A critical error occurred in getAdminDashboardStats:", error);
    return getEmptyStats("A critical error occurred while fetching dashboard stats.");
  }
}
