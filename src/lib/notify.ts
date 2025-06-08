import { sendWhatsAppMessage } from './whatsapp';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function getUserById(userId: string) {
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() }) : null;
}

export async function notifyUserByWhatsApp(userId: string, message: string) {
  const user = await getUserById(userId);
  if (user && user.whatsappOptIn && user.phoneNumber) {
    await sendWhatsAppMessage(user.phoneNumber, message);
  }
}
