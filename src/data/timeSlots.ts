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

// Timetable periods corresponding to Malaysian secondary school timetable (aSc Jadual Waktu)
export interface TimetablePeriod {
  index: number;
  periodNumber?: number;
  label: string;          // "1", "2", ... "Rehat", "7", ...
  startTime: string;      // "07:00"
  endTime: string;        // "07:30"
  timeLabel: string;      // "7:00 - 7:30"
  isRehat?: boolean;
}

export const TIMETABLE_PERIODS: TimetablePeriod[] = [
  { index: 0, periodNumber: 1, label: '1', startTime: '07:00', endTime: '07:30', timeLabel: '7:00 - 7:30' },
  { index: 1, periodNumber: 2, label: '2', startTime: '07:30', endTime: '08:00', timeLabel: '7:30 - 8:00' },
  { index: 2, periodNumber: 3, label: '3', startTime: '08:00', endTime: '08:30', timeLabel: '8:00 - 8:30' },
  { index: 3, periodNumber: 4, label: '4', startTime: '08:30', endTime: '09:00', timeLabel: '8:30 - 9:00' },
  { index: 4, periodNumber: 5, label: '5', startTime: '09:00', endTime: '09:30', timeLabel: '9:00 - 9:30' },
  { index: 5, periodNumber: 6, label: '6', startTime: '09:30', endTime: '10:00', timeLabel: '9:30 - 10:00' },
  { index: 6, label: 'Rehat', startTime: '10:00', endTime: '10:30', timeLabel: '10:00 - 10:30', isRehat: true },
  { index: 7, periodNumber: 7, label: '7', startTime: '10:30', endTime: '11:00', timeLabel: '10:30 - 11:00' },
  { index: 8, periodNumber: 8, label: '8', startTime: '11:00', endTime: '11:30', timeLabel: '11:00 - 11:30' },
  { index: 9, periodNumber: 9, label: '9', startTime: '11:30', endTime: '12:00', timeLabel: '11:30 - 12:00' },
  { index: 10, periodNumber: 10, label: '10', startTime: '12:00', endTime: '12:30', timeLabel: '12:00 - 12:30' },
  { index: 11, periodNumber: 11, label: '11', startTime: '12:30', endTime: '13:00', timeLabel: '12:30 - 13:00' },
  { index: 12, periodNumber: 12, label: '12', startTime: '13:00', endTime: '13:30', timeLabel: '13:00 - 13:30' },
  { index: 13, label: 'REHAT', startTime: '13:30', endTime: '14:00', timeLabel: '13:30 - 14:00', isRehat: true },
  { index: 14, label: 'REHAT', startTime: '14:00', endTime: '14:30', timeLabel: '14:00 - 14:30', isRehat: true },
  { index: 15, periodNumber: 13, label: '13', startTime: '14:30', endTime: '15:00', timeLabel: '14:30 - 15:00' },
  { index: 16, periodNumber: 14, label: '14', startTime: '15:00', endTime: '15:30', timeLabel: '15:00 - 15:30' },
  { index: 17, periodNumber: 15, label: '15', startTime: '15:30', endTime: '16:00', timeLabel: '15:30 - 16:00' },
  { index: 18, periodNumber: 16, label: '16', startTime: '16:00', endTime: '16:30', timeLabel: '16:00 - 16:30' },
  { index: 19, periodNumber: 17, label: '17', startTime: '16:30', endTime: '17:00', timeLabel: '16:30 - 17:00' },
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

export const DEFAULT_PURPOSES: string[] = [
  'Teaching and Learning (PdPc)',
  'Speaking Test / Oral Assessment',
  'Listening Test / UASA',
  'SPM English Workshop',
  'English Language Society Activity',
  'Debate & Public Speaking Training',
  'Meeting / Teacher Briefing',
  'Remedial / Enrichment Class',
];

// Helper to calculate duration in hours between two "HH:mm" strings
export function calculateDurationHours(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime || !startTime.includes(':') || !endTime.includes(':')) {
    return 0;
  }
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const diffMin = Math.max(endMin - startMin, 0);
  return Math.round((diffMin / 60) * 10) / 10;
}

// Format 24h to 12h time (e.g. "07:00" -> "7:00 AM", "14:30" -> "2:30 PM")
export function formatTime12h(time24?: string): string {
  if (!time24 || !time24.includes(':')) return '';
  const [h, m] = time24.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}
