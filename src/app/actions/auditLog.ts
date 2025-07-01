
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { AuditActionType } from '@/types/database';
import { getUserDisplayName } from './notificationsUtils';
import { createHash } from 'crypto';

/**
 * Logs an audit trail entry to Firestore.
 * @param actorId - The UID of the user performing the action.
 * @param action - The type of action being performed.
 * @param details - A human-readable description of the action.
 * @param targetId - The ID of the entity being affected.
 * @param targetType - The type of the entity being affected.
 * @param payload - The data payload associated with the action, to be hashed.
 */
export async function logAudit(
  actorId: string,
  action: AuditActionType,
  details: string,
  targetId?: string,
  targetType?: 'user' | 'project' | 'task',
  payload?: any
): Promise<void> {
  if (!actorId) {
    console.warn('[logAudit] actorId is missing. Audit log not created.');
    return;
  }
  try {
    const actorName = await getUserDisplayName(actorId);

    // Simple payload hashing for audit purposes
    const payloadHash = payload 
      ? createHash('sha256').update(JSON.stringify(payload)).digest('hex').substring(0, 12)
      : undefined;

    const logData = {
      actorId,
      actorName,
      action,
      details,
      targetId: targetId || '',
      targetType: targetType || 'none',
      payloadHash: payloadHash || '',
      timestamp: serverTimestamp(),
    };

    await addDoc(collection(db, 'auditLogs'), logData);
  } catch (error) {
    console.error(`[logAudit] Error creating audit log for action "${action}" by user ${actorId}:`, error);
  }
}
