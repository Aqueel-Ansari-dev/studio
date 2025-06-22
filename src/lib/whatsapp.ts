import twilio from 'twilio';

/**
 * Sends a WhatsApp message using a provider like Twilio.
 * Can send a text message, a media file, or both.
 */
export async function sendWhatsAppMessage(to: string, message?: string, mediaUrl?: string): Promise<void> {
  if (!to || (!message && !mediaUrl)) {
    console.warn('[WhatsApp] SKIPPED: Missing "to" or content ("message" or "mediaUrl").');
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    const body = message || 'Media attachment.';
    console.warn(`[WhatsApp] SKIPPED: Twilio environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM) are not configured. Message for ${to}: "${body}"`);
    return;
  }
  
  try {
    const client = twilio(accountSid, authToken);
    
    // Twilio's library expects this to be 'any' to accommodate different message types
    const messageData: any = {
      from: fromNumber, // e.g., 'whatsapp:+14155238886'
      to: `whatsapp:${to}`, // Client's number in 'whatsapp:+15551234567' format
    };

    if (message) {
      messageData.body = message;
    }
    
    if (mediaUrl) {
      messageData.mediaUrl = [mediaUrl];
    }

    const response = await client.messages.create(messageData);
    console.log(`[WhatsApp] Message sent to ${to}. SID: ${response.sid}`);
  } catch (error) {
    console.error(`[WhatsApp] Failed to send message to ${to}:`, error);
    // Optional: You could re-throw the error or handle it as needed
    // throw error; 
  }
}
