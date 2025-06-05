
'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { InventoryItem, EmployeeExpense } from '@/types/database';

export interface ProjectExpenseReportData {
  projectId: string;
  totalMaterialCost: number;
  totalApprovedEmployeeExpenses: number;
  breakdownByType: {
    travel: number;
    food: number;
    tools: number;
    other: number;
  };
  // Could also include:
  // - totalPendingEmployeeExpenses: number;
  // - detailedMaterialList: InventoryItem[];
  // - detailedApprovedExpenses: EmployeeExpense[];
}

export async function getProjectExpenseReport(
  projectId: string,
  requestingUserId: string
): Promise<ProjectExpenseReportData | { error: string }> {
  // Security: Verify requestingUserId has permission to view reports for this project (e.g., supervisor of project, admin)
  if (!requestingUserId) {
    return { error: 'User not authenticated.' };
  }
  if (!projectId) {
    return { error: 'Project ID is required.' };
  }

  try {
    // 1. Calculate Total Material Cost from projectInventory
    const inventoryCollectionRef = collection(db, 'projectInventory');
    const inventoryQuery = query(inventoryCollectionRef, where('projectId', '==', projectId));
    const inventorySnapshot = await getDocs(inventoryQuery);

    let totalMaterialCost = 0;
    inventorySnapshot.docs.forEach(docSnap => {
      const item = docSnap.data() as InventoryItem; // Assuming basic InventoryItem structure
      totalMaterialCost += (item.quantity || 0) * (item.costPerUnit || 0);
    });
    totalMaterialCost = parseFloat(totalMaterialCost.toFixed(2));


    // 2. Calculate Total Approved Employee Expenses and Breakdown by Type
    const expensesCollectionRef = collection(db, 'employeeExpenses');
    const expensesQuery = query(
      expensesCollectionRef,
      where('projectId', '==', projectId),
      where('approved', '==', true) // Only include approved expenses
    );
    const expensesSnapshot = await getDocs(expensesQuery);

    let totalApprovedEmployeeExpenses = 0;
    const breakdownByType: ProjectExpenseReportData['breakdownByType'] = {
      travel: 0,
      food: 0,
      tools: 0,
      other: 0,
    };

    expensesSnapshot.docs.forEach(docSnap => {
      const expense = docSnap.data() as EmployeeExpense; // Assuming basic EmployeeExpense structure
      totalApprovedEmployeeExpenses += expense.amount || 0;
      if (expense.type && breakdownByType.hasOwnProperty(expense.type)) {
        breakdownByType[expense.type] += expense.amount || 0;
      } else if (expense.type) { // Handles if a new type was somehow added not in enum
        breakdownByType.other += expense.amount || 0;
      }
    });
    totalApprovedEmployeeExpenses = parseFloat(totalApprovedEmployeeExpenses.toFixed(2));
    Object.keys(breakdownByType).forEach(key => {
      breakdownByType[key as keyof typeof breakdownByType] = parseFloat(breakdownByType[key as keyof typeof breakdownByType].toFixed(2));
    });
    

    return {
      projectId,
      totalMaterialCost,
      totalApprovedEmployeeExpenses,
      breakdownByType,
    };

  } catch (error) {
    console.error(`Error generating expense report for project ${projectId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         return { error: `Query requires a Firestore index. Please check server logs for a link to create it. Details: ${errorMessage}` };
    }
    return { error: `Failed to generate project expense report: ${errorMessage}` };
  }
}
