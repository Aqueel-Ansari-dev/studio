
import { sendWhatsAppMessage } from './whatsapp';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { Employee } from '@/types/database'; 

export async function getUserById(userId: string): Promise<Employee | null> {
  if (!userId) return null;
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Employee) : null;
}

export async function notifyUserByWhatsApp(userId: string, message: string) {
  const user = await getUserById(userId);
  
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
    console.log(`[Notify] WhatsApp message to ${userId} SKIPPED: User not found.`);
  }
}

/**
 * Sends a WhatsApp message to all users of a given role. Optionally exclude one user.
 */
export async function notifyRoleByWhatsApp(
  role: 'employee' | 'supervisor' | 'admin',
  message: string,
  excludeUserId?: string
): Promise<void> {
  try {
    const usersSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', role)));
    const notifyPromises: Promise<void>[] = [];
    usersSnapshot.forEach((docSnap) => {
      if (docSnap.id !== excludeUserId) {
        const data = docSnap.data() as Employee;
        if (data.whatsappOptIn && data.phoneNumber) {
          notifyPromises.push(sendWhatsAppMessage(data.phoneNumber, message));
        }
      }
    });
    await Promise.all(notifyPromises);
  } catch (error) {
    console.error(`[Notify] Failed to notify role ${role} via WhatsApp:`, error);
  }
}
