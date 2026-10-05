import { Booking, BookingLog, TelegramConfig, ClassGroup } from '../types';
import { getInitialBookings, getInitialLogs } from '../data/mockInitialData';
import { DEFAULT_TELEGRAM_CONFIG } from './telegramService';
import { DEFAULT_TEACHERS, DEFAULT_CLASSES, DEFAULT_CLASS_GROUPS } from '../data/timeSlots';

const STORAGE_KEYS = {
  BOOKINGS: 'sakura_eng_lab_bookings_v4',
  LOGS: 'sakura_eng_lab_logs_v4',
  TELEGRAM: 'sakura_eng_lab_telegram_v4',
  TEACHERS: 'sakura_teachers_list_v4',
  CLASSES: 'sakura_classes_list_v4',
  CLASS_GROUPS: 'sakura_class_groups_v5',
};

// Bookings
export async function fetchBookings(): Promise<Booking[]> {
  try {
    const res = await fetch('/api/bookings');
    if (res.ok) {
      const serverData = await res.json();
      if (Array.isArray(serverData)) {
        localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(serverData));
        return serverData;
      }
    }
  } catch (e) {}

  const local = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {}
  }

  const initial = getInitialBookings();
  localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(initial));
  return initial;
}

export async function saveBooking(booking: Booking): Promise<Booking> {
  const current = await fetchBookings();
  const index = current.findIndex(b => b.id === booking.id);
  let updatedList: Booking[];
  if (index >= 0) {
    updatedList = [...current];
    updatedList[index] = booking;
  } else {
    updatedList = [booking, ...current];
  }
  localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(updatedList));

  try {
    await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking),
    });
  } catch (e) {}

  return booking;
}

// Logs
export async function fetchLogs(): Promise<BookingLog[]> {
  try {
    const res = await fetch('/api/logs');
    if (res.ok) {
      const serverData = await res.json();
      if (Array.isArray(serverData) && serverData.length > 0) {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(serverData));
        return serverData;
      }
    }
  } catch (e) {}

  const local = localStorage.getItem(STORAGE_KEYS.LOGS);
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {}
  }

  const initial = getInitialLogs();
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(initial));
  return initial;
}

export async function addLog(log: BookingLog): Promise<BookingLog> {
  const current = await fetchLogs();
  const updated = [log, ...current];
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updated));

  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
  } catch (e) {}

  return log;
}

// Telegram
export async function fetchTelegramConfig(): Promise<TelegramConfig> {
  try {
    const res = await fetch('/api/telegram/config');
    if (res.ok) {
      const serverConfig = await res.json();
      if (serverConfig && (serverConfig.botToken || serverConfig.chatId)) {
        localStorage.setItem(STORAGE_KEYS.TELEGRAM, JSON.stringify(serverConfig));
        return serverConfig;
      }
    }
  } catch (e) {}

  const local = localStorage.getItem(STORAGE_KEYS.TELEGRAM);
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {}
  }

  return DEFAULT_TELEGRAM_CONFIG;
}

export async function saveTelegramConfig(config: TelegramConfig): Promise<void> {
  localStorage.setItem(STORAGE_KEYS.TELEGRAM, JSON.stringify(config));
  try {
    await fetch('/api/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  } catch (e) {}
}

// Teachers List Management
export function fetchTeachers(): string[] {
  const local = localStorage.getItem(STORAGE_KEYS.TEACHERS);
  if (local) {
    try {
      const list = JSON.parse(local);
      if (Array.isArray(list)) return list;
    } catch (e) {}
  }
  localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(DEFAULT_TEACHERS));
  return DEFAULT_TEACHERS;
}

export function saveTeachers(teachers: string[]): void {
  localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(teachers));
}

// Classes List Management
export function fetchClasses(): string[] {
  const local = localStorage.getItem(STORAGE_KEYS.CLASSES);
  if (local) {
    try {
      const list = JSON.parse(local);
      if (Array.isArray(list)) return list;
    } catch (e) {}
  }
  localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(DEFAULT_CLASSES));
  return DEFAULT_CLASSES;
}

export function saveClasses(classes: string[]): void {
  localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
}

// Class Groups Management
export function fetchClassGroups(): ClassGroup[] {
  const local = localStorage.getItem(STORAGE_KEYS.CLASS_GROUPS);
  if (local) {
    try {
      const groups = JSON.parse(local);
      if (Array.isArray(groups) && groups.length > 0) return groups;
    } catch (e) {}
  }
  localStorage.setItem(STORAGE_KEYS.CLASS_GROUPS, JSON.stringify(DEFAULT_CLASS_GROUPS));
  return DEFAULT_CLASS_GROUPS;
}

export function saveClassGroups(groups: ClassGroup[]): void {
  localStorage.setItem(STORAGE_KEYS.CLASS_GROUPS, JSON.stringify(groups));
  // Keep flattened classes list synced
  const flat = groups.flatMap(g => g.subclasses);
  saveClasses(flat);
}
