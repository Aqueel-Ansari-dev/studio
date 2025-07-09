
import { sendWhatsAppMessage } from './whatsapp';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { User } from '@/types/database'; 

export async function getUserById(userId: string, organizationId: string): Promise<User | null> {
  if (!userId || !organizationId) return null;
  const snap = await getDoc(doc(db, 'organizations', organizationId, 'users', userId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as User) : null;
}

export async function notifyUserByWhatsApp(userId: string, organizationId: string, message: string) {
  const user = await getUserById(userId, organizationId);
  
  if (user) {
    console.log(`[Notify] Attempting to send WhatsApp to user ${userId} (${user.email}). Opt-in: ${user.whatsappOptIn}, Phone: ${user.phoneNumber ? 'Exists' : 'Missing'}`);
    if (user.whatsappOptIn && user.phoneNumber) {
      // The actual sending logic is now encapsulated in sendWhatsAppMessage
      await sendWhatsAppMessage(user.phoneNumber, message);
    } else {
      let skipReason = [];
      if (!user.whatsappOptIn) skipReason.push("not opted in");
      if (!user.phoneNumber) skipReason.push("phone number missing");
      console.log(`[Notify] WhatsApp message to ${userId} SKIPPED: User is ${skipReason.join(' and ')}.`);
    }
  } else {
    console.log(`[Notify] WhatsApp message to ${userId} SKIPPED: User not found in organization ${organizationId}.`);
  }
}

/**
 * Sends a WhatsApp message to all users of a given role within a specific organization.
 * Optionally exclude one user.
 */
export async function notifyRoleByWhatsApp(
  organizationId: string,
  role: 'employee' | 'supervisor' | 'admin',
  message: string,
  excludeUserId?: string
): Promise<void> {
  try {
    const usersCollectionRef = collection(db, 'organizations', organizationId, 'users');
    const q = query(usersCollectionRef, where('role', '==', role));
    const usersSnapshot = await getDocs(q);
    
    const notifyPromises: Promise<void>[] = [];
    usersSnapshot.forEach((docSnap) => {
      if (docSnap.id !== excludeUserId) {
        const data = docSnap.data() as User;
        if (data.whatsappOptIn && data.phoneNumber) {
          notifyPromises.push(sendWhatsAppMessage(data.phoneNumber, message));
        }
      }
    });
    await Promise.all(notifyPromises);
  } catch (error) {
    console.error(`[Notify] Failed to notify role ${role} in org ${organizationId} via WhatsApp:`, error);
  }
}
