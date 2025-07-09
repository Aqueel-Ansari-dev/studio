
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { AuditActionType } from '@/types/database';
import { getUserDisplayName } from './notificationsUtils';
import { createHash } from 'crypto';

/**
 * Logs an audit trail entry to Firestore under the correct organization.
 * @param actorId - The UID of the user performing the action.
 * @param organizationId - The ID of the organization where the action occurred.
 * @param action - The type of action being performed.
 * @param details - A human-readable description of the action.
 * @param targetId - The ID of the entity being affected.
 * @param targetType - The type of the entity being affected.
 * @param payload - The data payload associated with the action, to be hashed.
 */
export async function logAudit(
  actorId: string,
  organizationId: string,
  action: AuditActionType,
  details: string,
  targetId?: string,
  targetType?: 'user' | 'project' | 'task',
  payload?: any
): Promise<void> {
  if (!actorId || !organizationId) {
    console.warn('[logAudit] actorId or organizationId is missing. Audit log not created.');
    return;
  }
  try {
    const actorName = await getUserDisplayName(actorId, organizationId);

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

    await addDoc(collection(db, 'organizations', organizationId, 'auditLogs'), logData);
  } catch (error) {
    console.error(`[logAudit] Error creating audit log for action "${action}" by user ${actorId}:`, error);
  }
}
