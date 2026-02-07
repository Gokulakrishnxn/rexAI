/**
 * Local appointment event for calendar booking (offline, no paid APIs).
 */

export type AppointmentEvent = {
  id: string;
  title: string;
  specialty: string;
  datetime: string; // ISO string
  createdAt: string;
  source: 'chat' | 'voice' | 'call';
};
