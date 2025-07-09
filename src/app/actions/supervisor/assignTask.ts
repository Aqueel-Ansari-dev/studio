
// This action is being deprecated in favor of the more robust /actions/admin/assignTask.ts
// which now correctly handles multi-tenancy and both admin/supervisor roles.
// To prevent accidental use, we are commenting out the export.
// In a real project, this file would be deleted.

/*
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { notifyUserByWhatsApp } from '@/lib/notify';
import { getUserDisplayName, getProjectName, createSingleNotification } from '@/app/actions/notificationsUtils';
import type { Task, TaskStatus } from '@/types/database';
import { format } from 'date-fns';
import { createQuickTaskForAssignment, CreateQuickTaskInput, CreateQuickTaskResult } from './createTask'; // Import createQuickTask
import { logAudit } from '../auditLog';

// ... (rest of the file content)
*/

export {}
