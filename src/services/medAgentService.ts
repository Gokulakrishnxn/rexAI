/**
 * Schedule parsing + medication notifications.
 * Also provides GENERAL intent fallback for Router Agent (no paid APIs).
 */

export function parseScheduleFromText(text: string): { time: string; label: string }[] {
  // TODO: parse "take X at 8am" etc.
  return [];
}

export async function scheduleNotification(medId: string, at: Date): Promise<void> {
  // TODO: Expo Notifications
}

/** Free fallback reply when Router intent is GENERAL. No extra model calls. */
export async function getGeneralReply(_userText: string): Promise<string> {
  return "I'm Rex, your medical AI. How can I assist you with your records today?";
}
