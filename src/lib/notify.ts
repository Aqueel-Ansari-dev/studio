
import { sendWhatsAppMessage } from './whatsapp';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Employee } from '@/types/database'; // Added Employee type for better casting

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
