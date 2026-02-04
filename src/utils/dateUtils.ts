import { format, parseISO } from 'date-fns';

export function formatRecordDate(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy');
}

export function formatTime(iso: string): string {
  return format(parseISO(iso), 'h:mm a');
}
