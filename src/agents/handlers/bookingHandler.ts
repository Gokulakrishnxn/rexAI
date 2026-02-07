/**
 * Booking intent — schedule visit via calendar tool (offline, free).
 * Simple parsing: tomorrow, time (e.g. 4 pm).
 */

import { bookAppointment } from '../../tools/calendarTool';

function parseSpecialty(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('dentist')) return 'Dentist';
  if (t.includes('cardiologist') || t.includes('heart')) return 'Cardiologist';
  if (t.includes('physician') || t.includes('doctor')) return 'Doctor';
  if (t.includes('eye') || t.includes('optometrist')) return 'Eye care';
  return 'General';
}

/** Match "4 pm", "4pm", "10 am", "9:30 am" */
function parseTime(text: string): { hour: number; minute: number } | null {
  const t = text.toLowerCase();
  const match = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3];
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  return { hour, minute };
}

function hasDateOrTime(text: string): boolean {
  const t = text.toLowerCase();
  if (t.includes('tomorrow')) return true;
  if (/\d{1,2}\s*(am|pm)/.test(t)) return true;
  return false;
}

function buildDatetime(isTomorrow: boolean, hour: number, minute: number): string {
  const d = new Date();
  if (isTomorrow) d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export async function handleBooking(
  userText: string,
  source: 'chat' | 'voice' | 'call' = 'chat'
): Promise<string> {
  const t = userText.toLowerCase();
  const hasTomorrow = t.includes('tomorrow');
  const time = parseTime(userText);
  const specialty = parseSpecialty(userText);

  if (hasDateOrTime(t) && time) {
    const datetime = buildDatetime(hasTomorrow, time.hour, time.minute);
    return bookAppointment(specialty, datetime, source);
  }

  if (hasDateOrTime(t) && !time) {
    // e.g. "book tomorrow" without time — default 10 am
    const datetime = buildDatetime(hasTomorrow, 10, 0);
    return bookAppointment(specialty, datetime, source);
  }

  return 'Which doctor and what time?';
}
