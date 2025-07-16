
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { getOrganizationId } from '../common/getOrganizationId';
import { verifyRole } from '../common/verifyRole';
import type { FAQ, UserRole } from '@/types/database';

const FaqSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters.'),
  answer: z.string().min(10, 'Answer must be at least 10 characters.'),
  category: z.string().min(1, 'Category is required.'),
  targetRoles: z.array(z.custom<UserRole>()).min(1, 'At least one target role is required.'),
});

export type AddFaqInput = z.infer<typeof FaqSchema>;
export type UpdateFaqInput = z.infer<typeof FaqSchema>;

interface ServerActionResult {
  success: boolean;
  message: string;
  faqId?: string;
  errors?: z.ZodIssue[];
}

async function checkAdmin(adminId: string): Promise<{ authorized: boolean; organizationId: string | null }> {
  const organizationId = await getOrganizationId(adminId);
  if (!organizationId) {
    return { authorized: false, organizationId: null };
  }
  const isAuthorized = await verifyRole(adminId, ['admin']);
  return { authorized: isAuthorized, organizationId };
}

export async function addFaq(adminId: string, data: AddFaqInput): Promise<ServerActionResult> {
  const { authorized, organizationId } = await checkAdmin(adminId);
  if (!authorized || !organizationId) {
    return { success: false, message: 'Unauthorized action.' };
  }
  
  const validation = FaqSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: 'Invalid input.', errors: validation.error.issues };
  }
  
  try {
    const faqCollectionRef = collection(db, 'organizations', organizationId, 'faqs');
    const newFaq: Omit<FAQ, 'id'> = {
      ...validation.data,
      organizationId,
      createdBy: adminId,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };
    const docRef = await addDoc(faqCollectionRef, newFaq);
    return { success: true, message: 'FAQ added successfully.', faqId: docRef.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'An unknown error occurred.';
    return { success: false, message: msg };
  }
}

export async function updateFaq(adminId: string, faqId: string, data: UpdateFaqInput): Promise<ServerActionResult> {
  const { authorized, organizationId } = await checkAdmin(adminId);
  if (!authorized || !organizationId) {
    return { success: false, message: 'Unauthorized action.' };
  }

  const validation = FaqSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: 'Invalid input.', errors: validation.error.issues };
  }

  try {
    const faqDocRef = doc(db, 'organizations', organizationId, 'faqs', faqId);
    const updates = {
      ...validation.data,
      updatedAt: serverTimestamp(),
    };
    await updateDoc(faqDocRef, updates);
    return { success: true, message: 'FAQ updated successfully.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'An unknown error occurred.';
    return { success: false, message: msg };
  }
}

export async function deleteFaq(adminId: string, faqId: string): Promise<ServerActionResult> {
  const { authorized, organizationId } = await checkAdmin(adminId);
  if (!authorized || !organizationId) {
    return { success: false, message: 'Unauthorized action.' };
  }

  try {
    await deleteDoc(doc(db, 'organizations', organizationId, 'faqs', faqId));
    return { success: true, message: 'FAQ deleted successfully.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'An unknown error occurred.';
    return { success: false, message: msg };
  }
}


export async function fetchFaqs(adminId: string): Promise<{ success: boolean; faqs?: FAQ[]; error?: string }> {
  const { authorized, organizationId } = await checkAdmin(adminId);
  if (!authorized || !organizationId) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    const faqsRef = collection(db, 'organizations', organizationId, 'faqs');
    const q = query(faqsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const faqs = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            updatedAt: (data.updatedAt as Timestamp).toDate().toISOString(),
        } as FAQ
    });
    return { success: true, faqs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'An unknown error occurred.';
    return { success: false, error: msg };
  }
}
