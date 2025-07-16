
'use server';

/**
 * @fileOverview This file contains the "tools" that the Genkit chatbot flow can use.
 * Each tool is a server action that fetches specific data from the database.
 * The AI model intelligently decides which tool to call based on the user's query.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import type { Task, Project } from '@/types/database';

/**
 * Tool to get the current user's display name.
 */
export const getUserName = ai.defineTool(
  {
    name: 'getUserName',
    description: "Returns the display name of the user with the given ID. Use this to greet the user or refer to them by name.",
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user.'),
      organizationId: z.string().describe('The ID of the organization the user belongs to.'),
    }),
    outputSchema: z.string(),
  },
  async ({ userId, organizationId }) => {
    try {
      const userDocRef = doc(db, 'organizations', organizationId, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        return userDoc.data().displayName || userDoc.data().email || 'User';
      }
      return 'User';
    } catch (e) {
      return 'User'; // Fail gracefully
    }
  }
);

/**
 * Tool to get the current user's assigned tasks.
 */
export const getTasksForCurrentUser = ai.defineTool(
  {
    name: 'getTasksForCurrentUser',
    description: "Fetches a list of tasks assigned to the current user. Can be used to answer questions like 'What are my tasks?' or 'Do I have any pending work?'.",
    inputSchema: z.object({
      userId: z.string().describe('The ID of the user.'),
      organizationId: z.string().describe('The ID of the organization the user belongs to.'),
    }),
    outputSchema: z.array(z.object({
        taskName: z.string(),
        status: z.string(),
        projectId: z.string(),
        isImportant: z.boolean(),
    })),
  },
  async ({ userId, organizationId }) => {
    try {
      const tasksQuery = query(
        collection(db, 'organizations', organizationId, 'tasks'),
        where('assignedEmployeeId', '==', userId),
        where('status', 'in', ['pending', 'in-progress', 'paused']),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(tasksQuery);
      return snapshot.docs.map(doc => {
          const data = doc.data() as Task;
          return {
              taskName: data.taskName,
              status: data.status,
              projectId: data.projectId,
              isImportant: data.isImportant || false,
          }
      });
    } catch (error) {
        console.error("Error fetching tasks for user:", error);
        return []; // Return empty array on error
    }
  }
);


/**
 * Tool to get the status of projects. Can be scoped to a specific project or all projects.
 */
export const getProjectStatus = ai.defineTool(
  {
    name: 'getProjectStatus',
    description: "Provides the status of one or all projects within the organization. Useful for questions like 'What's the status of the new office project?' or 'How are my projects doing?'.",
    inputSchema: z.object({
      organizationId: z.string().describe("The user's organization ID."),
      projectName: z.string().optional().describe("The specific name of the project to check. If omitted, returns status for all projects."),
    }),
    outputSchema: z.array(z.object({
        name: z.string(),
        status: z.string(),
    })),
  },
  async ({ organizationId, projectName }) => {
    try {
        const projectsRef = collection(db, 'organizations', organizationId, 'projects');
        let q = query(projectsRef);
        if (projectName) {
            q = query(q, where('name', '==', projectName));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data() as Project;
            return {
                name: data.name,
                status: data.status,
            };
        });
    } catch (error) {
        console.error("Error fetching project status:", error);
        return [];
    }
  }
);
