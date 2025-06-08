export async function sendWhatsAppMessage(to: string, message: string): Promise<void> {
  if (!to || !message) return;
  // Placeholder for real WhatsApp provider integration
  console.log(`[WhatsApp] \u27A4 ${to}: ${message}`);
}
