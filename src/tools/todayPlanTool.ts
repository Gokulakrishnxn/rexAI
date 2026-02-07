/**
 * Today Plan tool — aggregates medications, appointments, and digital twin nudges
 * for "What should I do today?" queries. Used by RouterAgent.
 */

import { useCalendarStore } from '../store/useCalendarStore';
import { useMedicationStore } from '../store/useMedicationStore';
import { useTwinStore } from '../store/useTwinStore';
import { format, parseISO, isToday } from 'date-fns';

export function getTodayPlan(): string {
  const lines: string[] = [];

  // Appointments today
  const { appointments } = useCalendarStore.getState();
  const todayAppointments = appointments.filter((a) => isToday(parseISO(a.datetime)));
  if (todayAppointments.length > 0) {
    lines.push('**Appointments today:**');
    todayAppointments.forEach((a) => {
      const time = format(parseISO(a.datetime), 'h:mm a');
      lines.push(`• ${a.specialty} at ${time}`);
    });
    lines.push('');
  } else {
    lines.push('**Appointments today:** None scheduled.');
    lines.push('');
  }

  // Medications (active, with times)
  const { medications } = useMedicationStore.getState();
  const activeMeds = medications.filter((m) => m.active);
  if (activeMeds.length > 0) {
    lines.push('**Medications:**');
    activeMeds.forEach((m) => {
      const times = m.times?.length ? m.times.join(', ') : m.frequency;
      const taken = m.takenToday ? ' ✓' : '';
      lines.push(`• ${m.name} (${m.dosage}) — ${times}${taken}`);
    });
    lines.push('');
  } else {
    lines.push('**Medications:** No active medications.');
    lines.push('');
  }

  // Digital Twin nudges
  const { twin } = useTwinStore.getState();
  if (twin?.nudges?.length) {
    lines.push('**Rex nudges:**');
    twin.nudges.forEach((n) => lines.push(`• ${n}`));
  }

  if (lines.length === 0) return "You have nothing scheduled for today. Stay hydrated and take it easy.";

  return lines.join('\n').trim();
}
