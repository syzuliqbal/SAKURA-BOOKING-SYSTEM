import React, { useState, useMemo, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  Send, 
  Upload, 
  Trash2, 
  FileText, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Key, 
  Plus, 
  Users, 
  GraduationCap, 
  Eye, 
  EyeOff,
  Filter,
  Calendar,
  Sparkles,
  ShieldCheck,
  Check,
  AlertTriangle,
  HelpCircle,
  Info,
  Hash,
  MessageSquare,
  Target,
  ChevronDown,
  ChevronUp,
  Sparkles as SparklesIcon
} from 'lucide-react';
import { Booking, BookingLog, TelegramConfig, ClassGroup } from '../types';
import { testTelegramConnection, parseTelegramThreadId, extractTelegramLinkDetails } from '../services/telegramService';
import { verifyAdminPin, changeAdminPin, exportSystemBackup, restoreSystemBackup, syncAllLocalSettingsToServer, executeFactoryReset } from '../services/storageService';
import { formatTime12h, calculateDurationHours, DEFAULT_PURPOSES } from '../data/timeSlots';

interface AdminPortalProps {
  isAuthenticated: boolean;
  onAuthenticate: (success: boolean) => void;
  telegramConfig: TelegramConfig;
  onSaveTelegramConfig: (cfg: TelegramConfig) => Promise<void>;
  schoolLogo: string | null;
  onSaveSchoolLogo: (logoDataUrl: string | null) => void;
  teachersList: string[];
  onSaveTeachersList: (teachers: string[]) => void;
  classesList: string[];
  onSaveClassesList: (classes: string[]) => void;
  classGroups: ClassGroup[];
  onSaveClassGroups: (groups: ClassGroup[]) => void;
  purposesList?: string[];
  onSavePurposesList?: (purposes: string[]) => void;
  bookings: Booking[];
  logs: BookingLog[];
  onCancelBooking: (bookingId: string) => Promise<void>;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  isAuthenticated,
  onAuthenticate,
  telegramConfig,
  onSaveTelegramConfig,
  schoolLogo,
  onSaveSchoolLogo,
  teachersList,
  onSaveTeachersList,
  classesList,
  onSaveClassesList,
  classGroups,
  onSaveClassGroups,
  purposesList = [],
  onSavePurposesList,
  bookings,
  logs,
  onCancelBooking,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<'teachers' | 'classes' | 'purposes' | 'telegram' | 'logo' | 'records' | 'security'>('teachers');

  // Confirmation modal dialog (replaces blocked window.confirm in iframe)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  // In-UI notification banner (replaces blocked alert() in iframe)
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showNotice = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setActionNotice({ type, message });
    setTimeout(() => setActionNotice(null), 4500);
  };

  // New Teacher inputs
  const [newTeacherName, setNewTeacherName] = useState('');

  // Class Group inputs
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupClasses, setNewGroupClasses] = useState('');
  const [addClsToGroupInputs, setAddClsToGroupInputs] = useState<Record<string, string>>({});

  // Activity Purposes inputs & editing state
  const [newPurposeName, setNewPurposeName] = useState('');
  const [editingPurposeIdx, setEditingPurposeIdx] = useState<number | null>(null);
  const [editingPurposeValue, setEditingPurposeValue] = useState('');

  // Telegram state
  const [botToken, setBotToken] = useState(telegramConfig.botToken || '');
  const [chatId, setChatId] = useState(telegramConfig.chatId || '');
  const [threadId, setThreadId] = useState(telegramConfig.threadId || '');
  const [groupTitle, setGroupTitle] = useState(telegramConfig.groupTitle || 'SAKURA Teachers');
  const [showToken, setShowToken] = useState(false);
  const [showTopicGuide, setShowTopicGuide] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Sync telegram state when prop updates from server sync
  useEffect(() => {
    if (telegramConfig) {
      if (telegramConfig.botToken) setBotToken(telegramConfig.botToken);
      if (telegramConfig.chatId) setChatId(telegramConfig.chatId);
      if (telegramConfig.threadId !== undefined) setThreadId(telegramConfig.threadId);
      if (telegramConfig.groupTitle) setGroupTitle(telegramConfig.groupTitle);
    }
  }, [telegramConfig]);

  // Smart URL parser for Chat ID: auto-extracts group ID & topic ID if user pasted a link
  const handleChatIdChange = (val: string) => {
    const raw = val.trim();
    // Pattern: https://t.me/c/1234567890/42
    const chatUrlMatch = raw.match(/t\.me\/c\/(\d+)(?:\/(\d+))?/);
    if (chatUrlMatch && chatUrlMatch[1]) {
      const extractedChatId = `-100${chatUrlMatch[1]}`;
      setChatId(extractedChatId);
      if (chatUrlMatch[2] && !threadId) {
        setThreadId(chatUrlMatch[2]);
        showNotice(`Extracted Chat ID (${extractedChatId}) and Topic ID (#${chatUrlMatch[2]}) from link!`, 'success');
      } else {
        showNotice(`Extracted Chat ID (${extractedChatId}) from link!`, 'success');
      }
      return;
    }
    setChatId(val);
  };

  // Smart URL parser for Topic ID: auto-extracts topic thread number if user pasted a link
  const handleTopicIdChange = (val: string) => {
    const raw = val.trim();
    // Pattern: https://t.me/c/1234567890/42 or https://t.me/groupname/42/100
    const topicUrlMatch = raw.match(/t\.me\/(?:c\/)?(?:-?\d+|[a-zA-Z0-9_]+)\/(\d+)(?:\/\d+)?/);
    if (topicUrlMatch && topicUrlMatch[1]) {
      setThreadId(topicUrlMatch[1]);
      showNotice(`Extracted Topic ID #${topicUrlMatch[1]} from link!`, 'success');
      return;
    }
    setThreadId(val);
  };

  // Security / Change PIN state
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Factory Reset state
  const [isFactoryResetModalOpen, setIsFactoryResetModalOpen] = useState(false);
  const [factoryResetPin, setFactoryResetPin] = useState('');
  const [factoryResetError, setFactoryResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Records Filter state (Month / Year)
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth(); // 0 to 11
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentMonthIdx)); // "all" or "0".."11"
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear)); // "all" or "2026"
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'confirmed' | 'cancelled' | 'prebooking'>('all');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Handle PIN verification (Default PIN: sakura)
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = await verifyAdminPin(pinInput.trim());
    if (isValid) {
      onAuthenticate(true);
      setPinError('');
    } else {
      setPinError('Incorrect Administrator PIN. Please try again.');
    }
  };

  // Handle Change PIN
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeMsg(null);

    if (newPinInput.trim().length < 3) {
      setPinChangeMsg({ type: 'error', text: 'New PIN must be at least 3 characters long.' });
      return;
    }
    if (newPinInput.trim() !== confirmPinInput.trim()) {
      setPinChangeMsg({ type: 'error', text: 'New PIN and Confirm PIN do not match.' });
      return;
    }

    const res = await changeAdminPin(currentPinInput.trim(), newPinInput.trim());
    if (res.success) {
      setPinChangeMsg({ type: 'success', text: 'Administrator PIN successfully updated across all devices!' });
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
    } else {
      setPinChangeMsg({ type: 'error', text: res.error || 'Failed to update PIN.' });
    }
  };

  // Handle Factory Reset confirmation
  const handleConfirmFactoryReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFactoryResetError('');
    if (!factoryResetPin.trim()) {
      setFactoryResetError('Please enter your Administrator PIN to confirm.');
      return;
    }

    setIsResetting(true);
    const res = await executeFactoryReset(factoryResetPin.trim());
    setIsResetting(false);

    if (res.success) {
      setIsFactoryResetModalOpen(false);
      showNotice('✓ Factory reset complete! All bookings, logs, teachers, and class groups have been wiped.', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } else {
      setFactoryResetError(res.error || 'Incorrect Administrator PIN. Reset cancelled.');
    }
  };

  // Add Teacher (supports single or comma-separated names)
  const handleAddTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim()) return;

    const rawNames = newTeacherName.split(',').map(n => n.trim()).filter(Boolean);
    if (rawNames.length === 0) return;

    const newNamesToAdd: string[] = [];
    rawNames.forEach(name => {
      if (!teachersList.includes(name) && !newNamesToAdd.includes(name)) {
        newNamesToAdd.push(name);
      }
    });

    if (newNamesToAdd.length === 0) {
      showNotice('All entered teacher names already exist in the list.', 'error');
      return;
    }

    const updated = [...teachersList, ...newNamesToAdd].sort();
    onSaveTeachersList(updated);
    setNewTeacherName('');
    showNotice(`Added ${newNamesToAdd.length} teacher(s) to the list.`, 'success');
  };

  // Delete Teacher (Trigger in-UI confirmation)
  const handleDeleteTeacher = (name: string) => {
    if (teachersList.length <= 1) {
      showNotice('At least one teacher is required.', 'error');
      return;
    }

    setConfirmDialog({
      title: 'Remove Teacher',
      message: `Are you sure you want to remove "${name}" from the teachers list?`,
      confirmText: 'Remove Teacher',
      onConfirm: () => {
        const updated = teachersList.filter(t => t !== name);
        onSaveTeachersList(updated);
        showNotice(`Removed ${name} from teachers list.`, 'success');
      }
    });
  };

  // CLASS GROUPS MANAGEMENT

  // Create a new Class Group
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const gName = newGroupName.trim();
    if (!gName) return;

    if (classGroups.some(g => g.name.toLowerCase() === gName.toLowerCase())) {
      showNotice(`Class group "${gName}" already exists.`, 'error');
      return;
    }

    // Parse initial subclasses
    let initialSub: string[] = [];
    if (newGroupClasses.trim()) {
      initialSub = newGroupClasses.split(',').map(c => c.trim()).filter(Boolean);
    } else {
      // Default generate 1 to 5 e.g. "Einstein 1" to "Einstein 5"
      initialSub = [1, 2, 3, 4, 5].map(num => `${gName} ${num}`);
    }

    const newGrp: ClassGroup = {
      id: 'grp-' + Date.now(),
      name: gName,
      subclasses: initialSub,
    };

    const updated = [...classGroups, newGrp];
    onSaveClassGroups(updated);
    setNewGroupName('');
    setNewGroupClasses('');
    showNotice(`Created class group "${gName}" with ${initialSub.length} classes.`, 'success');
  };

  // Delete a Class Group (Trigger in-UI confirmation)
  const handleDeleteGroup = (groupId: string, groupName: string) => {
    if (classGroups.length <= 1) {
      showNotice('At least one class group is required.', 'error');
      return;
    }

    setConfirmDialog({
      title: 'Delete Class Group',
      message: `Are you sure you want to delete the entire "${groupName}" group and all its classes?`,
      confirmText: 'Delete Group',
      onConfirm: () => {
        const updated = classGroups.filter(g => g.id !== groupId);
        onSaveClassGroups(updated);
        showNotice(`Deleted group "${groupName}".`, 'success');
      }
    });
  };

  // Generate 1 to 5 for a group
  const handleGenerate1to5 = (groupId: string) => {
    const grp = classGroups.find(g => g.id === groupId);
    if (!grp) return;

    const baseName = grp.name;
    const generated = [1, 2, 3, 4, 5].map(n => `${baseName} ${n}`);
    const merged = Array.from(new Set([...grp.subclasses, ...generated]));

    const updated = classGroups.map(g => g.id === groupId ? { ...g, subclasses: merged } : g);
    onSaveClassGroups(updated);
    showNotice(`Generated ${baseName} 1 through 5.`, 'success');
  };

  // Add classes to an existing group
  const handleAddClassesToGroup = (groupId: string) => {
    const inputVal = (addClsToGroupInputs[groupId] || '').trim();
    if (!inputVal) return;

    const raw = inputVal.split(',').map(c => c.trim()).filter(Boolean);
    if (raw.length === 0) return;

    const updated = classGroups.map(g => {
      if (g.id !== groupId) return g;
      const combined = Array.from(new Set([...g.subclasses, ...raw]));
      return { ...g, subclasses: combined };
    });

    onSaveClassGroups(updated);
    setAddClsToGroupInputs(prev => ({ ...prev, [groupId]: '' }));
    showNotice(`Added ${raw.length} class(es).`, 'success');
  };

  // Remove a subclass from a group
  const handleRemoveSubclass = (groupId: string, subclass: string) => {
    const grp = classGroups.find(g => g.id === groupId);
    if (!grp) return;

    if (grp.subclasses.length <= 1) {
      showNotice(`Group "${grp.name}" must have at least one class. You can delete the group instead.`, 'error');
      return;
    }

    const updated = classGroups.map(g => {
      if (g.id !== groupId) return g;
      return { ...g, subclasses: g.subclasses.filter(c => c !== subclass) };
    });
    onSaveClassGroups(updated);
    showNotice(`Removed ${subclass} from ${grp.name}.`, 'success');
  };

  // Handle Logo Upload
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showNotice('Please select an image file (PNG, JPG).', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        onSaveSchoolLogo(result);
        showNotice('School logo uploaded successfully!', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  // Activity Purposes Handlers
  const handleAddPurpose = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newPurposeName.trim();
    if (!trimmed) {
      showNotice('Please enter an activity purpose name.', 'error');
      return;
    }
    if (purposesList.some(p => p.toLowerCase() === trimmed.toLowerCase())) {
      showNotice('This activity purpose already exists.', 'error');
      return;
    }
    const updated = [...purposesList, trimmed];
    if (onSavePurposesList) {
      onSavePurposesList(updated);
    }
    setNewPurposeName('');
    showNotice(`Added activity purpose: "${trimmed}".`, 'success');
  };

  const handleStartEditPurpose = (idx: number, currentVal: string) => {
    setEditingPurposeIdx(idx);
    setEditingPurposeValue(currentVal);
  };

  const handleSaveEditPurpose = (idx: number) => {
    const trimmed = editingPurposeValue.trim();
    if (!trimmed) {
      showNotice('Activity purpose cannot be empty.', 'error');
      return;
    }
    const duplicate = purposesList.some((p, i) => i !== idx && p.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      showNotice('Another activity purpose with this name already exists.', 'error');
      return;
    }
    const updated = [...purposesList];
    updated[idx] = trimmed;
    if (onSavePurposesList) {
      onSavePurposesList(updated);
    }
    setEditingPurposeIdx(null);
    setEditingPurposeValue('');
    showNotice(`Activity purpose updated to "${trimmed}".`, 'success');
  };

  const handleDeletePurpose = (idx: number, name: string) => {
    setConfirmDialog({
      title: 'Remove Activity Purpose',
      message: `Are you sure you want to remove "${name}" from the activity purposes list? It will no longer appear in the booking dropdown.`,
      confirmText: 'Remove Purpose',
      onConfirm: () => {
        const updated = purposesList.filter((_, i) => i !== idx);
        if (onSavePurposesList) {
          onSavePurposesList(updated);
        }
        showNotice(`Removed "${name}" from activity purposes.`, 'info');
      }
    });
  };

  const handleRestoreDefaultPurposes = () => {
    setConfirmDialog({
      title: 'Restore Default Activity Purposes',
      message: 'This will reset the activity purposes list to the standard Malaysian English lab purposes.',
      confirmText: 'Restore Defaults',
      onConfirm: () => {
        if (onSavePurposesList) {
          onSavePurposesList(DEFAULT_PURPOSES);
        }
        showNotice('Standard activity purposes restored.', 'success');
      }
    });
  };

  // Handle Telegram Test
  const handleTestTelegram = async () => {
    if (!botToken || !chatId) {
      setTestResult({ success: false, message: 'Please enter both Bot Token and Chat ID.' });
      return;
    }
    setIsTestingTelegram(true);
    setTestResult(null);

    const cleanThread = parseTelegramThreadId(threadId);
    const res = await testTelegramConnection(
      botToken.trim(),
      chatId.trim(),
      cleanThread !== undefined ? String(cleanThread) : undefined
    );
    setIsTestingTelegram(false);
    setTestResult({
      success: res.success,
      message: res.message,
    });
  };

  // Save Telegram Settings
  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTelegram(true);
    setSaveSuccessMsg('');

    const cleanThread = parseTelegramThreadId(threadId);

    const newCfg: TelegramConfig = {
      botToken: botToken.trim(),
      chatId: chatId.trim(),
      threadId: cleanThread !== undefined ? String(cleanThread) : '',
      groupTitle: groupTitle.trim(),
      enabled: true,
    };

    await onSaveTelegramConfig(newCfg);
    setIsSavingTelegram(false);
    setSaveSuccessMsg(
      cleanThread !== undefined
        ? `Telegram settings saved! Booking alerts will route exclusively to Topic #${cleanThread}.`
        : 'Telegram settings saved! Booking alerts will broadcast to the group.'
    );
    setTimeout(() => setSaveSuccessMsg(''), 5000);
  };

  // FILTERED BOOKINGS FOR RECORDS TAB
  const filteredRecords = useMemo(() => {
    return bookings.filter(b => {
      const bDate = new Date(b.date);
      const bYear = bDate.getFullYear();
      const bMonth = bDate.getMonth();

      if (selectedYear !== 'all' && bYear !== Number(selectedYear)) return false;
      if (selectedMonth !== 'all' && bMonth !== Number(selectedMonth)) return false;

      if (selectedStatus === 'confirmed' && b.status !== 'confirmed') return false;
      if (selectedStatus === 'cancelled' && b.status !== 'cancelled') return false;
      if (selectedStatus === 'prebooking' && (!b.isPrebooking || b.status === 'cancelled')) return false;

      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [bookings, selectedYear, selectedMonth, selectedStatus]);

  // Export Records to CSV (Filtered by Month / Year)
  const handleExportCSV = (mode: 'filtered' | 'year' | 'all') => {
    let dataset = bookings;
    let filenameSuffix = 'all';

    if (mode === 'filtered') {
      dataset = filteredRecords;
      const mLabel = selectedMonth !== 'all' ? monthNames[Number(selectedMonth)].toLowerCase() : 'all_months';
      filenameSuffix = `${selectedYear}_${mLabel}`;
    } else if (mode === 'year') {
      dataset = bookings.filter(b => new Date(b.date).getFullYear() === Number(selectedYear === 'all' ? currentYear : selectedYear));
      filenameSuffix = `year_${selectedYear === 'all' ? currentYear : selectedYear}`;
    }

    if (dataset.length === 0) {
      showNotice('No records available to export for the selected filter.', 'error');
      return;
    }

    const headers = [
      'Booking ID',
      'Date',
      'Start Time',
      'End Time',
      'Duration (Hours)',
      'Class',
      'Teacher',
      'Topic / Purpose',
      'Booking Type',
      'Recurring Schedule',
      'Status',
      'Notes',
      'Telegram Notified',
      'Created At'
    ];

    const rows = dataset.map(b => [
      `"${b.id}"`,
      `"${b.date}"`,
      `"${b.startTime}"`,
      `"${b.endTime}"`,
      calculateDurationHours(b.startTime, b.endTime),
      `"${(b.className || '').replace(/"/g, '""')}"`,
      `"${(b.teacherName || '').replace(/"/g, '""')}"`,
      `"${(b.title || '').replace(/"/g, '""')}"`,
      `"${b.isPrebooking ? 'Advance Pre-Booking' : 'Standard'}"`,
      `"${b.isRecurring && b.recurringUntil ? `Weekly until ${b.recurringUntil}` : 'Single'}"`,
      `"${b.status}"`,
      `"${(b.notes || '').replace(/"/g, '""')}"`,
      `"${b.telegramNotified ? 'Yes' : 'No'}"`,
      `"${b.createdAt}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sakura_english_lab_records_${filenameSuffix}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showNotice(`Exported ${dataset.length} records to CSV.`, 'success');
  };

  // LOCKED VIEW (PIN prompt)
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-2xl p-8 border border-stone-200 shadow-sm text-center font-sans">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-3.5 border border-amber-200">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-stone-900">Administrator Access Required</h2>
        <p className="text-xs text-stone-500 mt-1">
          Enter administrator PIN to manage teachers, classes, Telegram alerts, and records.
        </p>

        <form onSubmit={handleVerifyPin} className="mt-5 space-y-4">
          <div>
            <input
              type="password"
              autoFocus
              placeholder="Enter Admin PIN..."
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              className="w-full text-center text-sm tracking-widest font-mono p-3 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-rose-400"
            />
            {pinError && (
              <p className="text-xs text-rose-700 mt-2 font-medium">{pinError}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5"
          >
            <Key className="w-4 h-4 text-amber-300" />
            <span>Unlock Admin Portal</span>
          </button>
        </form>
      </div>
    );
  }

  // AUTHENTICATED VIEW
  return (
    <div className="space-y-6 max-w-5xl font-sans relative">
      {/* Action Notice Toast Banner */}
      {actionNotice && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className={`p-4 rounded-xl shadow-lg border flex items-center gap-2.5 text-xs font-semibold max-w-md ${
            actionNotice.type === 'success' 
              ? 'bg-stone-900 text-white border-stone-800' 
              : 'bg-rose-950 text-rose-100 border-rose-900'
          }`}>
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
            <button 
              type="button" 
              onClick={() => setActionNotice(null)} 
              className="ml-auto text-stone-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* In-UI Confirmation Modal Dialog (100% reliable inside iFrames) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-stone-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200 shrink-0 mt-0.5">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-stone-900">{confirmDialog.title}</h3>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">{confirmDialog.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-3.5 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white shadow-2xs transition-colors"
              >
                {confirmDialog.confirmText || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
            <Unlock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <span>SAKURA Administrator Portal</span>
              <span className="text-[10px] bg-teal-50 text-teal-800 font-bold px-2 py-0.5 rounded-full border border-teal-200">
                Unlocked
              </span>
            </h2>
            <p className="text-xs text-stone-500">
              Manage school faculty, class groups, Telegram integration, and export records
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAuthenticate(false)}
          className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl border border-stone-200 transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Lock className="w-3.5 h-3.5 text-stone-500" />
          <span>Lock Portal</span>
        </button>
      </div>

      {/* Subtab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveAdminSubTab('teachers')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
            activeAdminSubTab === 'teachers'
              ? 'bg-rose-100 text-rose-950 font-bold border border-rose-300'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-rose-700" />
          <span>Teachers ({teachersList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminSubTab('classes')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
            activeAdminSubTab === 'classes'
              ? 'bg-indigo-100 text-indigo-950 font-bold border border-indigo-300'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5 text-indigo-700" />
          <span>Class Groups ({classGroups.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminSubTab('purposes')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
            activeAdminSubTab === 'purposes'
              ? 'bg-amber-100 text-amber-950 font-bold border border-amber-300'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-700" />
          <span>Activity Purposes ({purposesList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminSubTab('records')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
            activeAdminSubTab === 'records'
              ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-emerald-700" />
          <span>Records &amp; Export</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminSubTab('telegram')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
            activeAdminSubTab === 'telegram'
              ? 'bg-sky-100 text-sky-950 font-bold border border-sky-300'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Send className="w-3.5 h-3.5 text-sky-700" />
          <span>Telegram Integration</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminSubTab('logo')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
            activeAdminSubTab === 'logo'
              ? 'bg-amber-100 text-amber-950 font-bold border border-amber-300'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Upload className="w-3.5 h-3.5 text-amber-700" />
          <span>School Logo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminSubTab('security')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
            activeAdminSubTab === 'security'
              ? 'bg-purple-100 text-purple-950 font-bold border border-purple-300'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
          <span>Change PIN</span>
        </button>
      </div>

      {/* SUBTAB 1: MANAGE TEACHERS */}
      {activeAdminSubTab === 'teachers' && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-rose-600" />
              <span>Configure Teachers List</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Teachers will choose their name from a dropdown when booking the lab, eliminating the need to type manually.
            </p>
          </div>

          {/* Add Teacher Form */}
          <form onSubmit={handleAddTeacher} className="space-y-1.5">
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="e.g. Cikgu Noraini, Mr. Bryan Lee, Ustaz Ahmad (separate with commas)"
                value={newTeacherName}
                onChange={e => setNewTeacherName(e.target.value)}
                className="flex-1 text-xs p-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-rose-400"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-rose-200/90 text-rose-950 hover:bg-rose-200 text-xs font-semibold rounded-xl border border-rose-300 transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Teacher(s)</span>
              </button>
            </div>
            <p className="text-[10px] text-stone-500">
              💡 Tip: You can add multiple teachers at once by separating their names with a comma.
            </p>
          </form>

          {/* Teachers List Grid */}
          {teachersList.length === 0 ? (
            <div className="p-6 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200">
              <p className="text-xs text-stone-500 font-medium">No teachers added yet.</p>
              <p className="text-[11px] text-stone-400 mt-0.5">Use the input above to add your school teachers.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
              {teachersList.map((teacher) => (
                <div
                  key={teacher}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-800"
                >
                  <span className="font-semibold truncate mr-2">{teacher}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteTeacher(teacher)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                    title={`Delete ${teacher}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: MANAGE CLASS GROUPS & SUBCLASSES */}
      {activeAdminSubTab === 'classes' && (
        <div className="space-y-5">
          {/* Create New Group Card */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                <span>Create New Class Group</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Organize classes into separable groups (e.g., <strong>Einstein</strong> with <strong>Einstein 1 to Einstein 5</strong>).
              </p>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Einstein, Curie, Newton, Form 1..."
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Classes in Group (Optional comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Einstein 1, Einstein 2, Einstein 3... (or leave blank to auto-create 1-5)"
                    value={newGroupClasses}
                    onChange={e => setNewGroupClasses(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-stone-500">
                  Tip: If classes are left blank, it will automatically generate 1 to 5.
                </span>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Group</span>
                </button>
              </div>
            </form>
          </div>

          {/* Existing Groups List */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Configured Class Groups ({classGroups.length})
            </h4>

            {classGroups.map(group => (
              <div key={group.id} className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-stone-900">{group.name}</span>
                    <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                      {group.subclasses.length} classes
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleGenerate1to5(group.id)}
                      className="px-2.5 py-1 text-[11px] font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors flex items-center gap-1"
                      title={`Add ${group.name} 1 through 5`}
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>Generate 1-5</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title={`Delete entire ${group.name} group`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Subclass Badges */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {group.subclasses.map(cls => (
                    <div
                      key={cls}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-800 font-medium"
                    >
                      <span>{cls}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubclass(group.id, cls)}
                        className="text-stone-400 hover:text-red-600 p-0.5 rounded-full hover:bg-red-50 transition-colors ml-0.5"
                        title={`Remove ${cls}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add more to this group */}
                <div className="pt-2 border-t border-stone-100 flex gap-2">
                  <input
                    type="text"
                    placeholder={`Add more classes to ${group.name} (comma-separated)...`}
                    value={addClsToGroupInputs[group.id] || ''}
                    onChange={e => setAddClsToGroupInputs({ ...addClsToGroupInputs, [group.id]: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddClassesToGroup(group.id);
                      }
                    }}
                    className="flex-1 text-xs p-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddClassesToGroup(group.id)}
                    className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-semibold rounded-xl transition-colors shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB: MANAGE ACTIVITY PURPOSES */}
      {activeAdminSubTab === 'purposes' && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-100 gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Configure Activity Purposes Dropdown</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Teachers will select the activity purpose from a dropdown when booking the lab, keeping records standardized and easy to categorize.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRestoreDefaultPurposes}
              className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
              title="Reset to default Malaysian English lab purposes"
            >
              <span>↺ Restore Defaults</span>
            </button>
          </div>

          {/* Add New Purpose Form */}
          <form onSubmit={handleAddPurpose} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Speaking Assessment / Oral, Choral Speaking Practice, SPM Workshop..."
              value={newPurposeName}
              onChange={e => setNewPurposeName(e.target.value)}
              className="flex-1 text-xs p-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Purpose</span>
            </button>
          </form>

          {/* Purposes List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-500 font-semibold px-1">
              <span>Configured Activity Purposes ({purposesList.length})</span>
              <span>Available in Booking Dropdown</span>
            </div>

            {purposesList.length === 0 ? (
              <div className="text-center py-8 rounded-xl border border-dashed border-stone-200 text-stone-400 text-xs">
                No activity purposes configured. Click "Restore Defaults" above or add a new purpose.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {purposesList.map((purpose, idx) => {
                  const usageCount = bookings.filter(b => b.title === purpose).length;
                  const isEditing = editingPurposeIdx === idx;

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 flex items-center justify-between gap-3 transition-colors shadow-2xs"
                    >
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editingPurposeValue}
                            onChange={e => setEditingPurposeValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveEditPurpose(idx);
                              } else if (e.key === 'Escape') {
                                setEditingPurposeIdx(null);
                              }
                            }}
                            autoFocus
                            className="flex-1 text-xs p-1.5 rounded-lg border border-amber-300 bg-white focus:ring-2 focus:ring-amber-400"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditPurpose(idx)}
                            className="px-2.5 py-1.5 bg-emerald-600 text-white text-[11px] font-bold rounded-lg hover:bg-emerald-700 shrink-0"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPurposeIdx(null)}
                            className="px-2 py-1.5 bg-stone-200 text-stone-700 text-[11px] font-semibold rounded-lg hover:bg-stone-300 shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-xs text-stone-900 truncate" title={purpose}>
                              {purpose}
                            </div>
                            <div className="text-[10px] text-stone-500 mt-0.5 flex items-center gap-1.5">
                              <span>Used in {usageCount} {usageCount === 1 ? 'booking' : 'bookings'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditPurpose(idx, purpose)}
                              className="px-2 py-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg transition-colors"
                              title="Edit purpose name"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePurpose(idx, purpose)}
                              className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete purpose"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: USAGE RECORDS & MONTHLY/YEARLY EXPORT */}
      {activeAdminSubTab === 'records' && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-100 gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Lab Usage Records &amp; Export</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Filter reservations by month and year, and export official CSV reports.
              </p>
            </div>

            {/* Export Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportCSV('filtered')}
                className="px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-semibold text-xs rounded-xl border border-emerald-300 transition-colors flex items-center gap-1.5 shadow-2xs"
                title="Export filtered records"
              >
                <Download className="w-3.5 h-3.5 text-emerald-800" />
                <span>Export Filtered ({filteredRecords.length})</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportCSV('year')}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs rounded-xl border border-stone-300 transition-colors flex items-center gap-1.5"
                title="Export full selected year"
              >
                <Download className="w-3.5 h-3.5 text-stone-600" />
                <span>Export Year ({selectedYear === 'all' ? currentYear : selectedYear})</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-stone-600 font-semibold">
              <Filter className="w-3.5 h-3.5 text-stone-500" />
              <span>Filters:</span>
            </div>

            {/* Month Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500 font-medium">Month:</span>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-white border border-stone-300 rounded-lg px-2.5 py-1 text-xs text-stone-800 font-medium"
              >
                <option value="all">All Months</option>
                {monthNames.map((m, idx) => (
                  <option key={m} value={String(idx)}>{m}</option>
                ))}
              </select>
            </div>

            {/* Year Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500 font-medium">Year:</span>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="bg-white border border-stone-300 rounded-lg px-2.5 py-1 text-xs text-stone-800 font-medium"
              >
                <option value="all">All Years</option>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500 font-medium">Status:</span>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value as any)}
                className="bg-white border border-stone-300 rounded-lg px-2.5 py-1 text-xs text-stone-800 font-medium"
              >
                <option value="all">All Bookings</option>
                <option value="confirmed">Confirmed Only</option>
                <option value="prebooking">Pre-Bookings Only</option>
                <option value="cancelled">Cancelled Only</option>
              </select>
            </div>

            {(selectedMonth !== 'all' || selectedYear !== 'all' || selectedStatus !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth('all');
                  setSelectedYear('all');
                  setSelectedStatus('all');
                }}
                className="text-rose-700 hover:text-rose-900 underline font-medium ml-auto"
              >
                Reset
              </button>
            )}
          </div>

          {/* Results Summary */}
          <div className="text-xs text-stone-500 flex items-center justify-between">
            <span>
              Showing <strong>{filteredRecords.length}</strong> record{filteredRecords.length === 1 ? '' : 's'}
              {selectedMonth !== 'all' ? ` for ${monthNames[Number(selectedMonth)]}` : ''}
              {selectedYear !== 'all' ? ` ${selectedYear}` : ''}
            </span>
          </div>

          {/* Records Table */}
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full text-left text-xs min-w-[650px]">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Date &amp; Time</th>
                  <th className="py-2.5 px-3 font-semibold">Class</th>
                  <th className="py-2.5 px-3 font-semibold">Teacher</th>
                  <th className="py-2.5 px-3 font-semibold">Purpose / Lesson</th>
                  <th className="py-2.5 px-3 font-semibold">Type</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-stone-400">
                      No records match the selected month/year filter.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(b => (
                    <tr key={b.id} className="hover:bg-stone-50/50">
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-stone-700">
                        <div>{b.date}</div>
                        <div className="text-[11px] text-stone-500">
                          {formatTime12h(b.startTime)} - {formatTime12h(b.endTime)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-stone-800 whitespace-nowrap">
                        {b.className}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-stone-700 whitespace-nowrap">
                        {b.teacherName}
                      </td>
                      <td className="py-2.5 px-3 text-stone-700 max-w-xs truncate" title={b.title}>
                        {b.title}
                        {b.isRecurring && b.recurringUntil && (
                          <div className="text-[10px] text-amber-700">
                            🔁 Weekly until {b.recurringUntil}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {b.isPrebooking ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Pre-Booking
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                            Standard
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          b.status === 'confirmed' 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {b.status === 'confirmed' && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDialog({
                                title: 'Cancel Booking',
                                message: `Are you sure you want to cancel the booking for "${b.title}" (${b.className} by ${b.teacherName}) on ${b.date}?`,
                                confirmText: 'Yes, Cancel Booking',
                                onConfirm: async () => {
                                  await onCancelBooking(b.id);
                                  showNotice(`Booking for ${b.className} cancelled.`, 'success');
                                }
                              });
                            }}
                            className="text-stone-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Cancel booking"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 4: TELEGRAM INTEGRATION */}
      {activeAdminSubTab === 'telegram' && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs space-y-5">
          <div className="border-b border-stone-100 pb-3">
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-sky-600" />
              <span>Telegram Group Bot Configuration</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Whenever a teacher books the English lab, an instant message is broadcast to the teachers' Telegram group.
            </p>
          </div>

          <form onSubmit={handleSaveTelegram} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Telegram Group Title / Nickname
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SAKURA English Teachers"
                value={groupTitle}
                onChange={e => setGroupTitle(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-sky-400"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Bot Token (from @BotFather)
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  required
                  placeholder="e.g. 7123456789:AAH...exampleToken"
                  value={botToken}
                  onChange={e => setBotToken(e.target.value)}
                  className="w-full p-2.5 pr-10 font-mono rounded-xl border border-stone-300 focus:ring-2 focus:ring-sky-400"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-stone-700">
                  Target Chat ID (Group ID or Channel ID)
                </label>
                <span className="text-[10px] text-stone-500 font-mono">
                  Supergroup starts with -100
                </span>
              </div>
              <input
                type="text"
                required
                placeholder="e.g. -1001234567890"
                value={chatId}
                onChange={e => handleChatIdChange(e.target.value)}
                className="w-full p-2.5 font-mono rounded-xl border border-stone-300 focus:ring-2 focus:ring-sky-400"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                For Telegram groups with topics enabled, the Chat ID begins with <code>-100</code> followed by your group identifier.
              </p>
            </div>

            {/* TOPIC / FORUM THREAD ID CONFIGURATION */}
            <div className="p-4 rounded-xl border border-sky-100 bg-sky-50/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                    <Hash className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <label className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
                      <span>Telegram Group Topic ID (message_thread_id)</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                        {threadId ? 'Topic Specific' : 'Optional'}
                      </span>
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTopicGuide(!showTopicGuide)}
                  className="text-xs text-sky-700 hover:text-sky-900 font-medium flex items-center gap-1 self-start sm:self-auto"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showTopicGuide ? 'Hide Topic Guide' : 'How to find Topic ID?'}</span>
                  {showTopicGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              <p className="text-[11px] text-stone-600 leading-relaxed">
                If your Telegram group has <strong>Topics (Forums)</strong> enabled, enter the Topic ID below. The bot will send booking alerts <strong>strictly and exclusively to that one topic</strong> without bothering other topics in the group.
              </p>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="e.g. 42 (or paste topic/message link like https://t.me/c/.../42)"
                    value={threadId}
                    onChange={e => handleTopicIdChange(e.target.value)}
                    className="w-full p-2.5 font-mono text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-sky-400 bg-white"
                  />
                </div>
                {threadId && (
                  <button
                    type="button"
                    onClick={() => {
                      setThreadId('');
                      showNotice('Cleared Topic ID. Alerts will broadcast to the group / General topic.', 'info');
                    }}
                    className="px-3 py-2.5 text-xs text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl border border-stone-200 shrink-0 font-medium"
                    title="Send to general group"
                  >
                    Clear Topic
                  </button>
                )}
              </div>

              {/* ROUTING DESTINATION STATUS */}
              <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2.5 border ${
                threadId && parseTelegramThreadId(threadId) !== undefined
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border-amber-200'
              }`}>
                {threadId && parseTelegramThreadId(threadId) !== undefined ? (
                  <>
                    <Target className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold">Targeted Topic Active: </span>
                      <span>
                        Alerts will be sent <strong>ONLY to Topic #{parseTelegramThreadId(threadId)}</strong>. Other topics in this group will NOT receive alerts.
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold">Whole Group Mode: </span>
                      <span>
                        No specific topic selected. Alerts will be posted to the entire group or General topic.
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* EXPANDABLE TOPIC ID GUIDE */}
              {showTopicGuide && (
                <div className="p-3.5 bg-white rounded-xl border border-sky-200 shadow-2xs space-y-2.5 text-xs animate-in fade-in">
                  <div className="font-bold text-sky-950 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-sky-600" />
                    <span>How to get your Telegram Topic ID in 3 easy steps:</span>
                  </div>
                  
                  <div className="space-y-2 text-stone-700 pl-1">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <p>
                        Open your Telegram group in <strong>Telegram Desktop</strong>, <strong>Telegram Web</strong>, or the <strong>Telegram mobile app</strong>.
                      </p>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <p>
                        Navigate to the specific topic where you want alerts (e.g. <em>#English-Lab-Bookings</em>). Right-click the topic name (or long-press/open topic menu on mobile) and click <strong>"Copy Link"</strong> (or copy the link of any message in that topic).
                      </p>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <div>
                        <p>
                          Your copied link looks like this:
                        </p>
                        <div className="mt-1 p-2 bg-stone-900 text-stone-100 font-mono text-[11px] rounded-lg break-all">
                          https://t.me/c/<span className="text-amber-300">1234567890</span>/<span className="text-emerald-400 font-bold">42</span>
                        </div>
                        <ul className="mt-1.5 space-y-0.5 text-[11px] text-stone-600 list-disc list-inside">
                          <li>The first number is your Chat ID: <code>-1001234567890</code></li>
                          <li>The last number <code>42</code> is your <strong>Topic ID</strong>!</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-stone-100 text-[11px] text-sky-800 bg-sky-50/60 p-2 rounded-lg">
                    ✨ <strong>Tip:</strong> You can simply paste the entire copied link (<code>https://t.me/c/...</code>) directly into either the Chat ID or Topic ID box above, and the system will automatically parse and configure both for you!
                  </div>
                </div>
              )}
            </div>

            {testResult && (
              <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                testResult.success 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {saveSuccessMsg && (
              <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleTestTelegram}
                disabled={isTestingTelegram || !botToken || !chatId}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl border border-stone-300 transition-colors flex items-center gap-1.5"
              >
                {isTestingTelegram ? (
                  <span>Sending Test...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-stone-600" />
                    <span>Send Test Message</span>
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={isSavingTelegram}
                className="px-5 py-2 bg-sky-200 hover:bg-sky-300 text-sky-950 font-semibold rounded-xl border border-sky-300 transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                {isSavingTelegram ? <span>Saving...</span> : <span>Save Settings</span>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUBTAB 5: SCHOOL EMBLEM & LOGO */}
      {activeAdminSubTab === 'logo' && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-600" />
              <span>School Logo / Crest</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Upload your official school badge (PNG or JPG) to display in the header and sidebar.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-stone-50 rounded-xl border border-stone-200">
            <div className="w-24 h-24 rounded-2xl bg-white border border-stone-200 flex items-center justify-center p-2 shadow-2xs">
              {schoolLogo ? (
                <img src={schoolLogo} alt="School Logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-3xl">🌸</span>
              )}
            </div>

            <div className="space-y-2 text-center sm:text-left">
              <label className="inline-block px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white font-semibold text-xs rounded-xl cursor-pointer shadow-2xs transition-colors">
                <span>Upload New Logo</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg"
                  onChange={handleLogoFileUpload}
                  className="hidden"
                />
              </label>

              {schoolLogo && (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      onSaveSchoolLogo(null);
                      showNotice('Restored default school emblem.', 'success');
                    }}
                    className="text-xs text-rose-700 hover:text-rose-900 underline font-medium"
                  >
                    Reset to Default SAKURA Emblem
                  </button>
                </div>
              )}

              <p className="text-[11px] text-stone-400">
                Recommended: Square PNG image with transparent background.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 6: SECURITY & CHANGE ADMIN PIN */}
      {activeAdminSubTab === 'security' && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs space-y-4 max-w-xl">
          <div className="border-b border-stone-100 pb-3">
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Change Administrator PIN</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Update the PIN required to access this Administrator Portal.
            </p>
          </div>

          {pinChangeMsg && (
            <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
              pinChangeMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {pinChangeMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{pinChangeMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePin} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Current Admin PIN *
              </label>
              <input
                type="password"
                required
                placeholder="Enter current PIN"
                value={currentPinInput}
                onChange={e => setCurrentPinInput(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-stone-300 font-mono focus:ring-2 focus:ring-purple-400"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                New Admin PIN *
              </label>
              <input
                type="password"
                required
                placeholder="Enter new PIN"
                value={newPinInput}
                onChange={e => setNewPinInput(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-stone-300 font-mono focus:ring-2 focus:ring-purple-400"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Confirm New Admin PIN *
              </label>
              <input
                type="password"
                required
                placeholder="Confirm new PIN"
                value={confirmPinInput}
                onChange={e => setConfirmPinInput(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-stone-300 font-mono focus:ring-2 focus:ring-purple-400"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Update Administrator PIN</span>
              </button>
            </div>
          </form>

          {/* CLOUD STORAGE & BACKUP CONTROLS */}
          <div className="mt-8 pt-6 border-t border-stone-200 space-y-3">
            <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Data Persistence & Backup Tools</span>
            </h4>
            <p className="text-xs text-stone-500">
              Ensure all your admin settings, teachers, class groups, and Telegram configurations are permanently preserved in server storage, or download an offline JSON backup.
            </p>

            <div className="flex flex-wrap gap-2.5 pt-2">
              {/* Force sync */}
              <button
                type="button"
                onClick={async () => {
                  await syncAllLocalSettingsToServer();
                  showNotice('✓ All settings, teachers, logo & Telegram config saved permanently to server storage!', 'success');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save &amp; Lock to Server File</span>
              </button>

              {/* Export Backup */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const data = await exportSystemBackup();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `sakura_lab_backup_${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showNotice('Backup downloaded successfully.', 'success');
                  } catch (e: any) {
                    showNotice('Failed to download backup: ' + e.message, 'error');
                  }
                }}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-stone-300"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export System Backup (.json)</span>
              </button>

              {/* Import Backup */}
              <label className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-stone-300 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Restore Backup (.json)</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                      try {
                        const parsed = JSON.parse(evt.target?.result as string);
                        await restoreSystemBackup(parsed);
                        showNotice('✓ Backup restored successfully! Refreshing data...', 'success');
                        setTimeout(() => window.location.reload(), 1200);
                      } catch (err: any) {
                        showNotice('Invalid backup JSON file: ' + err.message, 'error');
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            </div>
          </div>

          {/* DANGER ZONE: FACTORY RESET */}
          <div className="mt-8 pt-6 border-t border-rose-200">
            <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <h4 className="font-bold text-rose-950 text-sm">Danger Zone: System Factory Reset</h4>
              </div>
              <p className="text-xs text-rose-800 leading-relaxed">
                Permanently wipe all room bookings, audit logs, teacher rosters, and class groups from server storage. This returns the English Lab scheduling database to a clean slate. A confirmation step requiring your Administrator PIN is enforced before execution.
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setFactoryResetPin('');
                    setFactoryResetError('');
                    setIsFactoryResetModalOpen(true);
                  }}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-2xs"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Execute Factory Reset...</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FACTORY RESET CONFIRMATION MODAL */}
      {isFactoryResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-stone-900">Confirm Factory Reset</h3>
                <p className="text-xs text-stone-500">Security Authorization Required</p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 leading-relaxed">
              ⚠️ <strong>WARNING:</strong> This action is permanent and cannot be undone. All bookings, activity logs, teacher names, and custom class groups will be completely erased from the database.
            </div>

            <form onSubmit={handleConfirmFactoryReset} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Enter Administrator PIN to Authorize:
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    autoFocus
                    value={factoryResetPin}
                    onChange={(e) => {
                      setFactoryResetPin(e.target.value);
                      setFactoryResetError('');
                    }}
                    placeholder="Enter Admin PIN"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-mono"
                  />
                </div>
                {factoryResetError && (
                  <p className="text-xs text-rose-600 font-medium mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{factoryResetError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsFactoryResetModalOpen(false)}
                  disabled={isResetting}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting || !factoryResetPin.trim()}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  {isResetting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Wiping Data...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Permanently Wipe All Data</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
