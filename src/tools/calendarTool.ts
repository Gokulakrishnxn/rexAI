/**
 * Calendar booking tool — Google Calendar (primary) → local store (backup).
 * Used by chat, voice, and call flows.
 */

import type { AppointmentEvent } from '../types/appointment';
import { useCalendarStore } from '../store/useCalendarStore';
import { useTimelineStore } from '../store/useTimelineStore';
import { format } from 'date-fns';
import * as googleCalendarService from '../services/googleCalendarService';

function toTimelineSource(s: 'chat' | 'voice' | 'call'): 'chat' | 'voice' | 'system' {
  return s === 'call' ? 'system' : s;
}

export async function bookAppointment(
  specialty: string,
  datetime: string,
  source: 'chat' | 'voice' | 'call'
): Promise<string> {
  const id = `apt_${Date.now()}`;
  const title = `${specialty} appointment`;
  const event: AppointmentEvent = {
    id,
    title,
    specialty,
    datetime,
    createdAt: new Date().toISOString(),
    source,
  };

  // 1. Try Google Calendar insert
  const googleEventId = await googleCalendarService
    .insertEvent({ title, datetime, description: `Rex booking: ${specialty}` })
    .catch(() => null);

  if (googleEventId) {
    const d = new Date(datetime);
    const dateLabel = isTomorrow(d) ? 'Tomorrow' : format(d, 'MMM d, yyyy');
    const timeLabel = format(d, 'h a');
    const { addEvent } = useTimelineStore.getState();
    await addEvent({
      id: `tl_apt_${id}`,
      type: 'appointment',
      title: `Appointment booked: ${specialty}`,
      timestamp: new Date().toISOString(),
      source: toTimelineSource(source),
    });
    return `✅ Appointment booked: ${specialty} — ${dateLabel} ${timeLabel} (Google Calendar).`;
  }

  // 2. Fallback: local booking (already implemented)
  const { addAppointment } = useCalendarStore.getState();
  await addAppointment(event);

  const { addEvent } = useTimelineStore.getState();
  await addEvent({
    id: `tl_apt_${id}`,
    type: 'appointment',
    title: `Appointment booked: ${specialty}`,
    timestamp: new Date().toISOString(),
    source: toTimelineSource(source),
  });

  const d = new Date(datetime);
  const dateLabel = isTomorrow(d) ? 'Tomorrow' : format(d, 'MMM d, yyyy');
  const timeLabel = format(d, 'h a');
  return `✅ Appointment booked: ${specialty} — ${dateLabel} ${timeLabel}`;
}

function isTomorrow(d: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.toDateString() === tomorrow.toDateString();
}
