
'use server';

import { z } from 'zod';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getOrganizationId } from '../common/getOrganizationId';
import { createNotificationsForRole, getUserDisplayName, getProjectName } from '@/app/actions/notificationsUtils';
import type { DPR } from '@/types/database';

const DPRSchema = z.object({
  projectId: z.string().min(1, "Project is required."),
  reportDate: z.date(),
  progressPercentage: z.number().min(0).max(100),
  summary: z.string().min(10, "Summary must be at least 10 characters."),
  notes: z.string().optional(),
  issuesOrDelays: z.string().optional(),
  siteConditions: z.string().optional(),
  mediaDataUris: z.array(z.string()).optional(), // Array of base64 data URIs
});

export type SubmitDPRInput = z.infer<typeof DPRSchema>;

export interface SubmitDPRResult {
  success: boolean;
  message: string;
  dprId?: string;
  errors?: z.ZodIssue[];
}

export async function submitDPR(supervisorId: string, data: SubmitDPRInput): Promise<SubmitDPRResult> {
  const organizationId = await getOrganizationId(supervisorId);
  if (!organizationId) {
    return { success: false, message: "Could not determine organization for user." };
  }

  const validationResult = DPRSchema.safeParse(data);
  if (!validationResult.success) {
    return { success: false, message: "Invalid input data.", errors: validationResult.error.issues };
  }

  const { projectId, reportDate, progressPercentage, summary, notes, issuesOrDelays, siteConditions, mediaDataUris } = validationResult.data;
  
  try {
    const mediaUrls: string[] = [];
    if (mediaDataUris && mediaDataUris.length > 0) {
      for (const [index, dataUri] of mediaDataUris.entries()) {
        const dprId = doc(collection(db, 'dprs')).id; // generate an ID to use in path
        const fileRef = ref(storage, `dprs/${organizationId}/${projectId}/${dprId}/media_${index}.jpg`);
        const uploadResult = await uploadString(fileRef, dataUri, 'data_url');
        const downloadUrl = await getDownloadURL(uploadResult.ref);
        mediaUrls.push(downloadUrl);
      }
    }
    
    const dprCollectionRef = collection(db, 'organizations', organizationId, 'dprs');
    
    const newDprData: Omit<DPR, 'id'> = {
      organizationId,
      projectId,
      supervisorId,
      reportDate: Timestamp.fromDate(reportDate),
      progressPercentage,
      summary,
      notes: notes || '',
      issuesOrDelays: issuesOrDelays || '',
      siteConditions: siteConditions || '',
      mediaUrls,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(dprCollectionRef, newDprData);
    
    // --- Notification ---
    const supervisorName = await getUserDisplayName(supervisorId, organizationId);
    const projectName = await getProjectName(projectId, organizationId);
    
    await createNotificationsForRole(
      'admin',
      organizationId,
      'dpr-submitted',
      `New DPR for ${projectName}`,
      `${supervisorName} submitted a Daily Progress Report for project "${projectName}".`,
      docRef.id,
      'dpr',
      undefined,
      'general',
      'normal'
    );
    
    return { success: true, message: "Daily Progress Report submitted successfully!", dprId: docRef.id };
    
  } catch (error) {
    console.error("Error submitting DPR:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return { success: false, message: `Failed to submit DPR: ${errorMessage}` };
  }
}
