
import { twilio } from 'twilio';

/**
 * Sends a WhatsApp message using a provider like Twilio.
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
}
