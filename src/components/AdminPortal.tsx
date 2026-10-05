import React, { useState, useMemo } from 'react';
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
  Check
} from 'lucide-react';
import { Booking, BookingLog, TelegramConfig, ClassGroup } from '../types';
import { testTelegramConnection } from '../services/telegramService';
import { formatTime12h, calculateDurationHours } from '../data/timeSlots';

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
  bookings: Booking[];
  logs: BookingLog[];
  onCancelBooking: (bookingId: string) => Promise<void>;
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
  bookings,
  logs,
  onCancelBooking,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<'teachers' | 'classes' | 'telegram' | 'logo' | 'records' | 'security'>('teachers');

  // New Teacher inputs
  const [newTeacherName, setNewTeacherName] = useState('');

  // Class Group inputs
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupClasses, setNewGroupClasses] = useState('');
  const [addClsToGroupInputs, setAddClsToGroupInputs] = useState<Record<string, string>>({});

  // Telegram state
  const [botToken, setBotToken] = useState(telegramConfig.botToken || '');
  const [chatId, setChatId] = useState(telegramConfig.chatId || '');
  const [groupTitle, setGroupTitle] = useState(telegramConfig.groupTitle || 'SAKURA Teachers');
  const [showToken, setShowToken] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Security / Change PIN state
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPin = localStorage.getItem('sakura_admin_pin') || 'sakura';
    if (pinInput.trim() === storedPin) {
      onAuthenticate(true);
      setPinError('');
    } else {
      setPinError('Incorrect Administrator PIN. Please try again.');
    }
  };

  // Handle Change PIN
  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeMsg(null);
    const storedPin = localStorage.getItem('sakura_admin_pin') || 'sakura';

    if (currentPinInput.trim() !== storedPin) {
      setPinChangeMsg({ type: 'error', text: 'Current PIN is incorrect.' });
      return;
    }
    if (newPinInput.trim().length < 3) {
      setPinChangeMsg({ type: 'error', text: 'New PIN must be at least 3 characters long.' });
      return;
    }
    if (newPinInput.trim() !== confirmPinInput.trim()) {
      setPinChangeMsg({ type: 'error', text: 'New PIN and Confirm PIN do not match.' });
      return;
    }

    localStorage.setItem('sakura_admin_pin', newPinInput.trim());
    setPinChangeMsg({ type: 'success', text: 'Administrator PIN successfully updated!' });
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
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
      alert('All entered teacher names already exist in the list.');
      return;
    }

    const updated = [...teachersList, ...newNamesToAdd].sort();
    onSaveTeachersList(updated);
    setNewTeacherName('');
  };

  // Delete Teacher
  const handleDeleteTeacher = (name: string) => {
    if (teachersList.length <= 1) {
      alert('At least one teacher is required.');
      return;
    }
    if (window.confirm(`Remove ${name} from teachers list?`)) {
      const updated = teachersList.filter(t => t !== name);
      onSaveTeachersList(updated);
    }
  };

  // CLASS GROUPS MANAGEMENT

  // Create a new Class Group
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const gName = newGroupName.trim();
    if (!gName) return;

    if (classGroups.some(g => g.name.toLowerCase() === gName.toLowerCase())) {
      alert(`Class group "${gName}" already exists.`);
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
  };

  // Delete a Class Group
  const handleDeleteGroup = (groupId: string, groupName: string) => {
    if (classGroups.length <= 1) {
      alert('At least one class group is required.');
      return;
    }
    if (window.confirm(`Delete the entire "${groupName}" group and its classes?`)) {
      const updated = classGroups.filter(g => g.id !== groupId);
      onSaveClassGroups(updated);
    }
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
  };

  // Remove a subclass from a group
  const handleRemoveSubclass = (groupId: string, subclass: string) => {
    const grp = classGroups.find(g => g.id === groupId);
    if (!grp) return;

    if (grp.subclasses.length <= 1) {
      alert(`Group "${grp.name}" must have at least one class. Or delete the group instead.`);
      return;
    }

    const updated = classGroups.map(g => {
      if (g.id !== groupId) return g;
      return { ...g, subclasses: g.subclasses.filter(c => c !== subclass) };
    });
    onSaveClassGroups(updated);
  };

  // Handle Logo Upload
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (PNG, JPG).');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        onSaveSchoolLogo(result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Telegram Test
  const handleTestTelegram = async () => {
    if (!botToken || !chatId) {
      setTestResult({ success: false, message: 'Please enter both Bot Token and Chat ID.' });
      return;
    }
    setIsTestingTelegram(true);
    setTestResult(null);

    const res = await testTelegramConnection(botToken.trim(), chatId.trim());
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

    const newCfg: TelegramConfig = {
      botToken: botToken.trim(),
      chatId: chatId.trim(),
      groupTitle: groupTitle.trim(),
      enabled: true,
    };

    await onSaveTelegramConfig(newCfg);
    setIsSavingTelegram(false);
    setSaveSuccessMsg('Telegram settings saved and active!');
    setTimeout(() => setSaveSuccessMsg(''), 4000);
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
      alert('No records available to export for the selected filter.');
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
    <div className="space-y-6 max-w-5xl font-sans">
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
                    onClick={() => handleDeleteTeacher(teacher)}
                    className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                    title="Delete teacher"
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
                      className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Group"
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
                        onClick={() => handleRemoveSubclass(group.id, cls)}
                        className="text-stone-400 hover:text-red-600 p-0.5 rounded-full transition-colors"
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
                onClick={() => handleExportCSV('filtered')}
                className="px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-semibold text-xs rounded-xl border border-emerald-300 transition-colors flex items-center gap-1.5 shadow-2xs"
                title="Export filtered records"
              >
                <Download className="w-3.5 h-3.5 text-emerald-800" />
                <span>Export Filtered ({filteredRecords.length})</span>
              </button>

              <button
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
                            onClick={() => {
                              if (window.confirm(`Cancel booking for ${b.className} by ${b.teacherName}?`)) {
                                onCancelBooking(b.id);
                              }
                            }}
                            className="text-stone-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
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
              <label className="block font-semibold text-stone-700 mb-1">
                Target Chat ID (Group ID or Channel ID)
              </label>
              <input
                type="text"
                required
                placeholder="e.g. -1001234567890"
                value={chatId}
                onChange={e => setChatId(e.target.value)}
                className="w-full p-2.5 font-mono rounded-xl border border-stone-300 focus:ring-2 focus:ring-sky-400"
              />
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
                    onClick={() => onSaveSchoolLogo(null)}
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
        </div>
      )}
    </div>
  );
};
