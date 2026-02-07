/**
 * Schedule parsing + medication notifications.
 * Also provides GENERAL intent fallback for Router Agent (no paid APIs).
 */

import { DEMO_MODE } from '../constants/config';

export function parseScheduleFromText(text: string): { time: string; label: string }[] {
  // TODO: parse "take X at 8am" etc.
  return [];
}

export async function scheduleNotification(medId: string, at: Date): Promise<void> {
  // TODO: Expo Notifications
}

/** Free fallback reply when Router intent is GENERAL. No extra model calls. */
export async function getGeneralReply(userText: string): Promise<string> {
  if (DEMO_MODE) {
    const lower = userText.toLowerCase();
    if (lower.includes('hello') || lower.includes('hi')) return "Hello! I'm Rex. I'm running in offline Demo Mode. I can help you manage your records, check your health twin, or log vitals.";
    if (lower.includes('pain')) return "I understand you're in pain. Could you tell me more about where it hurts? I can help you log this in your timeline.";
    if (lower.includes('tired')) return "Fatigue can be a sign of many things. Let's check your recent activity. Have you been sleeping well?";
    return "I've noted that. Is there anything specific about your health you'd like to discuss?";
  }
  return "I'm Rex, your medical AI. How can I assist you with your records today?";
}
