export const SCHOOL_NAME = 'Sekolah Menengah Sains Kuching Utara (SAKURA)';
export const LAB_NAME = 'SAKURA English Language Lab Booking System';

// Hourly marks from 7:00 AM to 5:00 PM
export const CALENDAR_HOURS = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
];

// Available start/end time options in 30-min intervals
export const TIME_OPTIONS = [
  '07:00', '07:30',
  '08:00', '08:30',
  '09:00', '09:30',
  '10:00', '10:30',
  '11:00', '11:30',
  '12:00', '12:30',
  '13:00', '13:30',
  '14:00', '14:30',
  '15:00', '15:30',
  '16:00', '16:30',
  '17:00',
];

// Empty by default so user can input their own teachers
export const DEFAULT_TEACHERS: string[] = [];
export const DEFAULT_CLASSES: string[] = [];

export const DEFAULT_CLASS_GROUPS = [
  {
    id: 'group-einstein',
    name: 'Einstein',
    subclasses: ['Einstein 1', 'Einstein 2', 'Einstein 3', 'Einstein 4', 'Einstein 5'],
  },
  {
    id: 'group-curie',
    name: 'Curie',
    subclasses: ['Curie 1', 'Curie 2', 'Curie 3', 'Curie 4', 'Curie 5'],
  },
];

// Helper to calculate duration in hours between two "HH:mm" strings
export function calculateDurationHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const diffMin = Math.max(endMin - startMin, 0);
  return Math.round((diffMin / 60) * 10) / 10;
}

// Format 24h to 12h time (e.g. "07:00" -> "7:00 AM", "14:30" -> "2:30 PM")
export function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}
