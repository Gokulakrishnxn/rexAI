/**
 * Schedule parsing + medication notifications.
 */

export function parseScheduleFromText(text: string): { time: string; label: string }[] {
  // TODO: parse "take X at 8am" etc.
  return [];
}

export async function scheduleNotification(medId: string, at: Date): Promise<void> {
  // TODO: Expo Notifications
}
