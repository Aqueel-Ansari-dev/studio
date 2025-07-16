
'use server';
/**
 * @fileOverview A conversational chatbot flow for FieldOps.
 * This flow can answer questions about tasks, projects, and user information
 * by using a set of defined tools.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  getUserName,
  getTasksForCurrentUser,
  getProjectStatus,
} from '@/app/actions/chatbot/chatbotTools';

// Define the input schema for the chatbot flow
const ChatbotInputSchema = z.object({
  userId: z.string().describe('The ID of the user asking the question.'),
  organizationId: z.string().describe('The ID of the user\'s organization.'),
  query: z.string().describe('The user\'s question or message.'),
});
export type ChatbotInput = z.infer<typeof ChatbotInputSchema>;

// The output is a simple string response
const ChatbotOutputSchema = z.string();
export type ChatbotOutput = z.infer<typeof ChatbotOutputSchema>;

// Define the main prompt for the chatbot
const chatbotPrompt = ai.definePrompt({
  name: 'chatbotPrompt',
  input: { schema: ChatbotInputSchema },
  // The output from the model can sometimes be null, so we don't strictly enforce the output schema here.
  // We handle the validation and default response in the flow itself.
  // output: { schema: ChatbotOutputSchema },
  tools: [getUserName, getTasksForCurrentUser, getProjectStatus],
  system: `You are a helpful assistant for FieldOps, an application that helps manage field operations for various organizations.
Your name is 'FieldOps Assistant'.
You are friendly, concise, and helpful.

Use the available tools to answer user questions about their tasks, projects, and personal information.

Also, use the following knowledge base to answer general questions about how the app works.

--- KNOWLEDGE BASE ---
- To view tasks, users should go to the "My Tasks" section.
- Attendance is logged via the large Punch-in / Punch-out button at the bottom of the screen. This uses GPS and requires a selfie.
- Expenses can be logged under the "My Expenses" section. Receipts can be uploaded.
- Supervisors and Admins can assign tasks from the "Assign Task" page.
- Admins manage users, projects, and billing from the "Admin" section.
- To report a problem on-site, use the "Report Issue" page.
--- END KNOWLEDGE BASE ---

If you don't know the answer or a tool fails, say so politely. Do not make up information.
Your responses should be plain text, not JSON.`,
  prompt: `A user with ID '{{{userId}}}' from organization '{{{organizationId}}}' has sent the following message:

"{{{query}}}"

Please provide a helpful response.`,
});

// Define the main flow that orchestrates the chatbot logic
const chatbotFlow = ai.defineFlow(
  {
    name: 'chatbotFlow',
    inputSchema: ChatbotInputSchema,
    outputSchema: ChatbotOutputSchema,
  },
  async (input) => {
    // Call the prompt with the input and tools. Genkit handles the tool-calling logic.
    const { output } = await chatbotPrompt(input);
    // Handle cases where the model might return a null or empty response, ensuring we always return a string.
    return output || "I'm sorry, I couldn't find an answer to that. Can I help with something else?";
  }
);

/**
 * Exported wrapper function to be called from the client-side.
 * It takes the user's query and context, and returns the AI's response.
 */
export async function askChatbot(input: ChatbotInput): Promise<ChatbotOutput> {
  return chatbotFlow(input);
}
