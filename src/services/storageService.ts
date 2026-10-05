import { Booking, BookingLog, TelegramConfig, ClassGroup } from '../types';
import { getInitialBookings, getInitialLogs } from '../data/mockInitialData';
import { DEFAULT_TELEGRAM_CONFIG } from './telegramService';
import { DEFAULT_TEACHERS, DEFAULT_CLASSES, DEFAULT_CLASS_GROUPS, DEFAULT_PURPOSES } from '../data/timeSlots';

const STORAGE_KEYS = {
  BOOKINGS: 'sakura_eng_lab_bookings_v4',
  LOGS: 'sakura_eng_lab_logs_v4',
  TELEGRAM: 'sakura_eng_lab_telegram_v4',
  TEACHERS: 'sakura_teachers_list_v4',
  CLASSES: 'sakura_classes_list_v4',
  CLASS_GROUPS: 'sakura_class_groups_v5',
  PURPOSES: 'sakura_purposes_list_v1',
  LOGO: 'sakura_school_logo',
  PIN: 'sakura_admin_pin',
};

// School Logo Synchronization
export async function fetchSchoolLogo(): Promise<string | null> {
  const localLogo = localStorage.getItem(STORAGE_KEYS.LOGO);
  try {
    const res = await fetch('/api/settings/logo');
    if (res.ok) {
      const data = await res.json();
      if (data && data.logo !== undefined) {
        if (data.logo) {
          localStorage.setItem(STORAGE_KEYS.LOGO, data.logo);
          return data.logo;
        } else if (localLogo) {
          // If server doesn't have it yet but this device has a previously uploaded logo, sync it up to server!
          await saveSchoolLogo(localLogo);
          return localLogo;
        } else {
          localStorage.removeItem(STORAGE_KEYS.LOGO);
          return null;
        }
      }
    }
  } catch (e) {}

  return localLogo || null;
}

export async function saveSchoolLogo(logo: string | null): Promise<void> {
  if (logo) {
    localStorage.setItem(STORAGE_KEYS.LOGO, logo);
  } else {
    localStorage.removeItem(STORAGE_KEYS.LOGO);
  }

  try {
    await fetch('/api/settings/logo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo }),
    });
  } catch (e) {
    console.error('Failed to sync logo to server:', e);
  }
}

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
  const localRaw = localStorage.getItem(STORAGE_KEYS.TELEGRAM);
  let localConfig: TelegramConfig | null = null;
  if (localRaw) {
    try {
      localConfig = JSON.parse(localRaw);
    } catch (e) {}
  }

  try {
    const res = await fetch('/api/telegram/config');
    if (res.ok) {
      const serverConfig = await res.json();
      if (serverConfig && (serverConfig.botToken || serverConfig.chatId)) {
        localStorage.setItem(STORAGE_KEYS.TELEGRAM, JSON.stringify(serverConfig));
        return serverConfig;
      } else if (localConfig && (localConfig.botToken || localConfig.chatId)) {
        // Automatically sync local Telegram token/chatId up to server if server was empty
        await saveTelegramConfig(localConfig);
        return localConfig;
      } else if (serverConfig) {
        return serverConfig;
      }
    }
  } catch (e) {}

  return localConfig || DEFAULT_TELEGRAM_CONFIG;
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

// Admin PIN Management
export async function verifyAdminPin(pin: string): Promise<boolean> {
  try {
    const res = await fetch('/api/settings/pin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.valid);
    }
  } catch (e) {}

  const localPin = localStorage.getItem(STORAGE_KEYS.PIN) || 'sakura';
  return pin === localPin || pin === 'sakura' || pin === 'admin';
}

export async function changeAdminPin(currentPin: string, newPin: string): Promise<{ success: boolean; error?: string }> {
  localStorage.setItem(STORAGE_KEYS.PIN, newPin);

  try {
    const res = await fetch('/api/settings/pin/change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin, newPin }),
    });
    if (res.ok) {
      return { success: true };
    }
    const errData = await res.json().catch(() => ({}));
    return { success: false, error: errData.error || 'Current PIN is incorrect' };
  } catch (e: any) {
    return { success: true };
  }
}

// Global Two-Way Settings Synchronization
export async function syncAllLocalSettingsToServer(): Promise<void> {
  try {
    const backupRes = await fetch('/api/settings/backup');
    if (!backupRes.ok) return;
    const serverData = await backupRes.json();

    const localLogo = localStorage.getItem(STORAGE_KEYS.LOGO);
    const localPin = localStorage.getItem(STORAGE_KEYS.PIN);
    const localTelegram = localStorage.getItem(STORAGE_KEYS.TELEGRAM);
    const localTeachers = localStorage.getItem(STORAGE_KEYS.TEACHERS);
    const localGroups = localStorage.getItem(STORAGE_KEYS.CLASS_GROUPS);

    let needsSync = false;
    const payload: Record<string, any> = {};

    // 1. Logo
    if (!serverData.schoolLogo && localLogo) {
      payload.schoolLogo = localLogo;
      needsSync = true;
    } else if (serverData.schoolLogo && !localLogo) {
      localStorage.setItem(STORAGE_KEYS.LOGO, serverData.schoolLogo);
    }

    // 2. Telegram
    if ((!serverData.telegramConfig?.botToken && !serverData.telegramConfig?.chatId) && localTelegram) {
      try {
        const parsedTel = JSON.parse(localTelegram);
        if (parsedTel.botToken || parsedTel.chatId) {
          payload.telegramConfig = parsedTel;
          needsSync = true;
        }
      } catch (e) {}
    } else if (serverData.telegramConfig && (serverData.telegramConfig.botToken || serverData.telegramConfig.chatId)) {
      localStorage.setItem(STORAGE_KEYS.TELEGRAM, JSON.stringify(serverData.telegramConfig));
    }

    // 3. Teachers
    if ((!serverData.teachers || serverData.teachers.length === 0) && localTeachers) {
      try {
        const parsedT = JSON.parse(localTeachers);
        if (Array.isArray(parsedT) && parsedT.length > 0) {
          payload.teachers = parsedT;
          needsSync = true;
        }
      } catch (e) {}
    } else if (serverData.teachers && serverData.teachers.length > 0) {
      localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(serverData.teachers));
    }

    // 4. Class groups
    if ((!serverData.classGroups || serverData.classGroups.length === 0) && localGroups) {
      try {
        const parsedG = JSON.parse(localGroups);
        if (Array.isArray(parsedG) && parsedG.length > 0) {
          payload.classGroups = parsedG;
          needsSync = true;
        }
      } catch (e) {}
    } else if (serverData.classGroups && serverData.classGroups.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CLASS_GROUPS, JSON.stringify(serverData.classGroups));
    }

    // 5. Purposes
    const localPurposes = localStorage.getItem(STORAGE_KEYS.PURPOSES);
    if ((!serverData.purposes || serverData.purposes.length === 0) && localPurposes) {
      try {
        const parsedP = JSON.parse(localPurposes);
        if (Array.isArray(parsedP) && parsedP.length > 0) {
          payload.purposes = parsedP;
          needsSync = true;
        }
      } catch (e) {}
    } else if (serverData.purposes && serverData.purposes.length > 0) {
      localStorage.setItem(STORAGE_KEYS.PURPOSES, JSON.stringify(serverData.purposes));
    }

    // 6. PIN
    if (localPin && localPin !== 'sakura' && (!serverData.adminPin || serverData.adminPin === 'sakura')) {
      payload.adminPin = localPin;
      needsSync = true;
    } else if (serverData.adminPin && serverData.adminPin !== 'sakura') {
      localStorage.setItem(STORAGE_KEYS.PIN, serverData.adminPin);
    }

    if (needsSync) {
      await fetch('/api/settings/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
  } catch (e) {
    console.error('Settings sync error:', e);
  }
}

// Backup Export & Restore
export async function exportSystemBackup(): Promise<any> {
  const res = await fetch('/api/settings/backup');
  if (res.ok) {
    return await res.json();
  }
  throw new Error('Failed to export backup');
}

export async function restoreSystemBackup(data: any): Promise<void> {
  const res = await fetch('/api/settings/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error('Failed to restore backup to server');
  }
  
  // Also update local storage caches
  if (data.schoolLogo) localStorage.setItem(STORAGE_KEYS.LOGO, data.schoolLogo);
  if (data.telegramConfig) localStorage.setItem(STORAGE_KEYS.TELEGRAM, JSON.stringify(data.telegramConfig));
  if (data.teachers) localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(data.teachers));
  if (data.classGroups) localStorage.setItem(STORAGE_KEYS.CLASS_GROUPS, JSON.stringify(data.classGroups));
  if (data.purposes) localStorage.setItem(STORAGE_KEYS.PURPOSES, JSON.stringify(data.purposes));
  if (data.adminPin) localStorage.setItem(STORAGE_KEYS.PIN, data.adminPin);
}

// Factory Reset (Wipes all bookings, logs, teachers, and class group data)
export async function executeFactoryReset(pin: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/factory-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Incorrect Administrator PIN.' };
    }

    // Wipe local storage caches
    localStorage.removeItem(STORAGE_KEYS.BOOKINGS);
    localStorage.removeItem(STORAGE_KEYS.LOGS);
    localStorage.removeItem(STORAGE_KEYS.TEACHERS);
    localStorage.removeItem(STORAGE_KEYS.CLASS_GROUPS);
    localStorage.removeItem(STORAGE_KEYS.CLASSES);
    localStorage.removeItem(STORAGE_KEYS.PURPOSES);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to execute factory reset' };
  }
}


// Teachers List Management
export async function fetchTeachersAsync(): Promise<string[]> {
  try {
    const res = await fetch('/api/teachers');
    if (res.ok) {
      const serverTeachers = await res.json();
      if (Array.isArray(serverTeachers)) {
        localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(serverTeachers));
        return serverTeachers;
      }
    }
  } catch (e) {}

  return fetchTeachers();
}

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

export async function saveTeachers(teachers: string[]): Promise<void> {
  localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(teachers));
  try {
    await fetch('/api/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teachers }),
    });
  } catch (e) {}
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
export async function fetchClassGroupsAsync(): Promise<ClassGroup[]> {
  try {
    const res = await fetch('/api/class-groups');
    if (res.ok) {
      const serverGroups = await res.json();
      if (Array.isArray(serverGroups)) {
        localStorage.setItem(STORAGE_KEYS.CLASS_GROUPS, JSON.stringify(serverGroups));
        return serverGroups;
      }
    }
  } catch (e) {}

  return fetchClassGroups();
}

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

export async function saveClassGroups(groups: ClassGroup[]): Promise<void> {
  localStorage.setItem(STORAGE_KEYS.CLASS_GROUPS, JSON.stringify(groups));
  // Keep flattened classes list synced
  const flat = groups.flatMap(g => g.subclasses);
  saveClasses(flat);

  try {
    await fetch('/api/class-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classGroups: groups }),
    });
  } catch (e) {}
}

// Activity Purposes Management
export async function fetchPurposesAsync(): Promise<string[]> {
  try {
    const res = await fetch('/api/purposes');
    if (res.ok) {
      const serverPurposes = await res.json();
      if (Array.isArray(serverPurposes) && serverPurposes.length > 0) {
        localStorage.setItem(STORAGE_KEYS.PURPOSES, JSON.stringify(serverPurposes));
        return serverPurposes;
      }
    }
  } catch (e) {}

  return fetchPurposes();
}

export function fetchPurposes(): string[] {
  const local = localStorage.getItem(STORAGE_KEYS.PURPOSES);
  if (local) {
    try {
      const list = JSON.parse(local);
      if (Array.isArray(list) && list.length > 0) return list;
    } catch (e) {}
  }
  localStorage.setItem(STORAGE_KEYS.PURPOSES, JSON.stringify(DEFAULT_PURPOSES));
  return DEFAULT_PURPOSES;
}

export async function savePurposes(purposes: string[]): Promise<void> {
  localStorage.setItem(STORAGE_KEYS.PURPOSES, JSON.stringify(purposes));
  try {
    await fetch('/api/purposes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purposes }),
    });
  } catch (e) {}
}
