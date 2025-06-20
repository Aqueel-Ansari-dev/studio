
import { twilio } from 'twilio';

/**
 * Sends a WhatsApp message using a provider like Twilio.
 *
 * NOTE FOR THE USER: This is a placeholder function. To make this work, you need to:
 * 1. Sign up for a WhatsApp Business API provider (e.g., Twilio).
 * 2. Get your Account SID, Auth Token, and a Twilio phone number.
 * 3. Store these securely in your .env file (see the updated .env file for examples).
 * 4. Install the necessary client library: `npm install twilio`
 * 5. Uncomment and complete the code below with your logic.
 */
export async function sendWhatsAppMessage(to: string, message: string): Promise<void> {
  if (!to || !message) {
    console.warn('[WhatsApp] SKIPPED: Missing "to" or "message" parameter.');
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn(`[WhatsApp] SKIPPED: Twilio environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM) are not configured. Message for ${to}: "${message}"`);
    return;
  }
  
  // =================================================================
  // TODO: UNCOMMENT AND COMPLETE THIS SECTION
  // =================================================================
  /*
  try {
    const client = twilio(accountSid, authToken);
    const response = await client.messages.create({
      body: message,
      from: fromNumber, // e.g., 'whatsapp:+14155238886'
      to: `whatsapp:${to}`, // Client's number in 'whatsapp:+15551234567' format
    });
    console.log(`[WhatsApp] Message sent to ${to}. SID: ${response.sid}`);
  } catch (error) {
    console.error(`[WhatsApp] Failed to send message to ${to}:`, error);
    // Optional: You could re-throw the error or handle it as needed
    // throw error; 
  }
  */
  // =================================================================

  // For demonstration, we will just log the action to the console.
  // REMOVE THIS LOG once you implement the actual API call above.
  console.log(`[WhatsApp] DEMO MODE: Sending message to ${to}: "${message}"`);
}
