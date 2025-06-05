
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import type { InventoryItem } from '@/types/database';

// Made AddInventoryItemSchema a local constant
const AddInventoryItemSchema = z.object({
  projectId: z.string().min(1, { message: "Project ID is required."}),
  itemName: z.string().min(2, { message: "Item name must be at least 2 characters."}).max(100),
  quantity: z.number().positive({ message: "Quantity must be a positive number."}),
  unit: z.enum(['kg', 'pcs', 'm', 'liters', 'custom'], { message: "Invalid unit type."}),
  costPerUnit: z.number().nonnegative({ message: "Cost per unit cannot be negative."}),
  customUnitLabel: z.string().max(50).optional(),
  // createdBy: z.string().min(1, { message: "Creator ID is required."}) // This will be passed as a separate argument
});

export type AddInventoryItemInput = z.infer<typeof AddInventoryItemSchema>;

export interface AddMaterialResult {
  success: boolean;
  message: string;
  inventoryItemId?: string;
  errors?: z.ZodIssue[];
}

export async function addMaterialToInventory(actorUserId: string, data: AddInventoryItemInput): Promise<AddMaterialResult> {
  // In a real app, verify actorUserId has supervisor/admin role
  if (!actorUserId) {
    return { success: false, message: 'User not authenticated or authorized.' };
  }
  
  // Optional: Check if user is supervisor or admin
  // const userDoc = await getDoc(doc(db, 'users', actorUserId));
  // if (!userDoc.exists() || !['supervisor', 'admin'].includes(userDoc.data()?.role)) {
  //   return { success: false, message: 'User does not have permission to add inventory.' };
  // }

  const validationResult = AddInventoryItemSchema.safeParse(data);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input data.', errors: validationResult.error.issues };
  }

  const { projectId, itemName, quantity, unit, costPerUnit, customUnitLabel } = validationResult.data;

  // Validate project existence (optional, but good practice)
  const projectRef = doc(db, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) {
    return { success: false, message: `Project with ID ${projectId} not found.` };
  }

  if (unit === 'custom' && (!customUnitLabel || customUnitLabel.trim() === '')) {
    return { success: false, message: 'Custom unit label is required when unit is "custom".', errors: [{ path: ['customUnitLabel'], message: 'Custom unit label is required.', code: 'custom' }] };
  }


  try {
    const newInventoryItemData: Omit<InventoryItem, 'id' | 'createdAt'> & { createdAt: any } = {
      projectId,
      itemName,
      quantity,
      unit,
      costPerUnit,
      createdBy: actorUserId,
      createdAt: serverTimestamp(), // Firestore server-side timestamp
      ...(unit === 'custom' && customUnitLabel && { customUnitLabel }),
    };

    const docRef = await addDoc(collection(db, 'projectInventory'), newInventoryItemData);
    return { success: true, message: 'Material added to inventory successfully!', inventoryItemId: docRef.id };
  } catch (error) {
    console.error('Error adding material to inventory:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to add material: ${errorMessage}` };
  }
}

