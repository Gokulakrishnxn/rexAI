/**
 * Booking intent — suggest appointment and ask for confirmation.
 * Does NOT auto-book; returns suggestedTool for UI confirmation button.
 */

import { format } from 'date-fns';

export interface BookingResult {
  replyText: string;
  suggestedTool?: {
    type: 'BOOK_APPOINTMENT';
    payload: { title: string; datetime: string };
  };
}

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

function formatBookingLabel(specialty: string, datetime: string): string {
  const d = new Date(datetime);
  const isTomorrow = d.toDateString() === new Date(Date.now() + 86400000).toDateString();
  const dateLabel = isTomorrow ? 'Tomorrow' : format(d, 'EEEE, MMM d');
  const timeLabel = format(d, 'h a');
  return `${specialty} ${dateLabel} ${timeLabel}`;
}

export async function handleBooking(
  userText: string,
  _source: 'chat' | 'voice' | 'call' = 'chat'
): Promise<BookingResult> {
  const t = userText.toLowerCase();
  const hasTomorrow = t.includes('tomorrow');
  const time = parseTime(userText);
  const specialty = parseSpecialty(userText);

  if (hasDateOrTime(t) && time) {
    const datetime = buildDatetime(hasTomorrow, time.hour, time.minute);
    const label = formatBookingLabel(specialty, datetime);
    return {
      replyText: `✅ Appointment draft found: ${label}. Tap "Book Appointment" to confirm and save locally. (Google Calendar sync when OAuth is added.)`,
      suggestedTool: {
        type: 'BOOK_APPOINTMENT',
        payload: { title: specialty, datetime },
      },
    };
  }

  if (hasDateOrTime(t) && !time) {
    const datetime = buildDatetime(hasTomorrow, 10, 0);
    const label = formatBookingLabel(specialty, datetime);
    return {
      replyText: `✅ Appointment draft found: ${label}. Tap "Book Appointment" to confirm and save locally. (Google Calendar sync when OAuth is added.)`,
      suggestedTool: {
        type: 'BOOK_APPOINTMENT',
        payload: { title: specialty, datetime },
      },
    };
  }

  return { replyText: 'Which doctor and what time?' };
}
