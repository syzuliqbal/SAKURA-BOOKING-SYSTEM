import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Send, 
  AlertTriangle, 
  BookmarkPlus, 
  CheckCircle2,
  Users,
  GraduationCap,
  Repeat
} from 'lucide-react';
import { Booking, TelegramConfig, ClassGroup } from '../types';
import { TIME_OPTIONS, formatTime12h, calculateDurationHours } from '../data/timeSlots';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (bookingData: Partial<Booking>, sendTelegram: boolean, recurringDates?: string[]) => Promise<void>;
  existingBookings: Booking[];
  teachersList: string[];
  classesList: string[];
  classGroups?: ClassGroup[];
  initialDate?: string;
  initialStartTime?: string;
  initialIsPrebooking?: boolean;
  telegramConfig: TelegramConfig;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  existingBookings,
  teachersList,
  classesList,
  classGroups = [],
  initialDate,
  initialStartTime,
  initialIsPrebooking = false,
  telegramConfig,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  // If opening for a future date, default to isPrebooking = true
  const [isPrebooking, setIsPrebooking] = useState(() => {
    if (initialDate && initialDate > todayStr) return true;
    return initialIsPrebooking;
  });

  const [title, setTitle] = useState('');
  const [teacherName, setTeacherName] = useState(teachersList[0] || '');
  const [date, setDate] = useState(() => {
    if (initialIsPrebooking || (initialDate && initialDate > todayStr)) {
      return initialDate || todayStr;
    }
    return todayStr;
  });
  const [startTime, setStartTime] = useState(initialStartTime || '07:00');
  const [endTime, setEndTime] = useState('08:00');

  // Class Group Selection
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    return classGroups[0]?.id || '';
  });
  const [className, setClassName] = useState(() => {
    return classGroups[0]?.subclasses[0] || classesList[0] || '';
  });

  const currentGroup = useMemo(() => {
    return classGroups.find(g => g.id === selectedGroupId) || classGroups[0];
  }, [classGroups, selectedGroupId]);

  const groupClasses = useMemo(() => {
    if (currentGroup && currentGroup.subclasses.length > 0) {
      return currentGroup.subclasses;
    }
    return classesList;
  }, [currentGroup, classesList]);

  const [notes, setNotes] = useState('');
  const [prebookingReason, setPrebookingReason] = useState('');
  
  // Recurring booking state (Weekly until a specified end date)
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringUntil, setRecurringUntil] = useState(() => {
    // Default until end of November 2026 or 6 weeks ahead
    const d = new Date();
    d.setDate(d.getDate() + 42); // 6 weeks ahead
    return d.toISOString().split('T')[0];
  });

  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Sync initial props
  useEffect(() => {
    if (initialDate) {
      if (initialDate > todayStr) {
        setIsPrebooking(true);
        setDate(initialDate);
      } else {
        setDate(initialDate);
      }
    }
    if (initialStartTime) {
      setStartTime(initialStartTime);
      const [h, m] = initialStartTime.split(':').map(Number);
      const endH = Math.min(h + 1, 17);
      setEndTime(`${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
    if (initialIsPrebooking !== undefined) {
      setIsPrebooking(initialIsPrebooking);
      if (!initialIsPrebooking) setDate(todayStr);
    }
    if (teachersList.length > 0 && (!teacherName || !teachersList.includes(teacherName))) {
      setTeacherName(teachersList[0]);
    }
    if (classGroups.length > 0) {
      const activeGrp = classGroups.find(g => g.id === selectedGroupId) || classGroups[0];
      setSelectedGroupId(activeGrp.id);
      if (!className || !activeGrp.subclasses.includes(className)) {
        setClassName(activeGrp.subclasses[0] || '');
      }
    } else if (classesList.length > 0 && (!className || !classesList.includes(className))) {
      setClassName(classesList[0]);
    }
  }, [initialDate, initialStartTime, initialIsPrebooking, teachersList, classesList, classGroups, isOpen, todayStr]);

  // Handle switching booking mode
  const handleModeSwitch = (prebookingMode: boolean) => {
    setIsPrebooking(prebookingMode);
    if (!prebookingMode) {
      // Standard booking is strictly on the day itself
      setDate(todayStr);
      setIsRecurring(false);
    }
  };

  // Day of the week for chosen date
  const dayOfWeekName = useMemo(() => {
    try {
      const d = new Date(date + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'long' });
    } catch (e) {
      return 'Selected Day';
    }
  }, [date]);

  // Compute all dates if recurring
  const recurringDates = useMemo(() => {
    if (!isPrebooking || !isRecurring || !recurringUntil || recurringUntil <= date) {
      return [date];
    }
    const dates: string[] = [];
    const start = new Date(date + 'T00:00:00');
    const end = new Date(recurringUntil + 'T00:00:00');
    const curr = new Date(start);

    while (curr <= end && dates.length < 52) { // max 52 weeks
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 7);
    }
    return dates;
  }, [date, isPrebooking, isRecurring, recurringUntil]);

  // Conflict Detection across single date or all recurring dates
  const recurringConflicts = useMemo(() => {
    const [newStartH, newStartM] = startTime.split(':').map(Number);
    const [newEndH, newEndM] = endTime.split(':').map(Number);
    const newStartTotal = newStartH * 60 + newStartM;
    const newEndTotal = newEndH * 60 + newEndM;

    if (newEndTotal <= newStartTotal) return [];

    const datesToCheck = isRecurring && isPrebooking ? recurringDates : [date];
    const conflicts: { date: string; booking: Booking }[] = [];

    for (const d of datesToCheck) {
      const match = existingBookings.find(b => {
        if (b.date !== d || b.status === 'cancelled') return false;
        const [bhStartH, bhStartM] = b.startTime.split(':').map(Number);
        const [bhEndH, bhEndM] = b.endTime.split(':').map(Number);
        const bStartTotal = bhStartH * 60 + bhStartM;
        const bEndTotal = bhEndH * 60 + bhEndM;

        return newStartTotal < bEndTotal && newEndTotal > bStartTotal;
      });
      if (match) {
        conflicts.push({ date: d, booking: match });
      }
    }
    return conflicts;
  }, [existingBookings, date, recurringDates, startTime, endTime, isRecurring, isPrebooking]);

  if (!isOpen) return null;

  const durationHours = calculateDurationHours(startTime, endTime);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (teachersList.length === 0) {
      setFormError('No teachers available. Please add teachers in the Admin Portal first.');
      return;
    }
    if (classesList.length === 0) {
      setFormError('No classes available. Please add classes in the Admin Portal first.');
      return;
    }
    if (!title.trim()) {
      setFormError('Please enter a lesson topic or purpose.');
      return;
    }
    if (!teacherName) {
      setFormError('Please select a teacher.');
      return;
    }
    if (!className) {
      setFormError('Please select a class.');
      return;
    }
    if (startTime >= endTime) {
      setFormError('End time must be after start time.');
      return;
    }
    if (!isPrebooking && date !== todayStr) {
      setFormError('Standard bookings can only be done on the day itself. For future dates, please use Advance Pre-Booking.');
      return;
    }
    if (recurringConflicts.length > 0) {
      const first = recurringConflicts[0];
      setFormError(
        `Time Conflict on ${first.date}: ${first.booking.teacherName} already booked from ${formatTime12h(first.booking.startTime)} to ${formatTime12h(first.booking.endTime)} (${first.booking.title}).`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const bookingData: Partial<Booking> = {
        title: title.trim(),
        teacherName,
        date,
        startTime,
        endTime,
        className,
        isPrebooking,
        prebookingReason: isPrebooking ? (prebookingReason.trim() || 'Advance pre-booking') : undefined,
        isRecurring: isPrebooking && isRecurring,
        recurringUntil: isPrebooking && isRecurring ? recurringUntil : undefined,
        status: 'confirmed',
        notes: notes.trim(),
      };

      await onSubmit(bookingData, notifyTelegram, isPrebooking && isRecurring ? recurringDates : undefined);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit booking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-2xs overflow-y-auto font-sans">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-200 my-6 animate-in fade-in zoom-in duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isPrebooking ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {isPrebooking ? <BookmarkPlus className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                {isPrebooking ? 'Advance Pre-Booking' : 'Standard Lab Booking (Today)'}
              </h3>
              <p className="text-xs text-stone-500">
                SAKURA English Language Lab Booking System
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto py-4 space-y-4 pr-1 scrollbar-thin text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="bg-stone-100/80 p-1 rounded-xl flex items-center gap-1 font-semibold">
            <button
              type="button"
              onClick={() => handleModeSwitch(false)}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                !isPrebooking ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-rose-600" />
              <span>Standard (Today Only)</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeSwitch(true)}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                isPrebooking ? 'bg-white text-amber-950 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-amber-700" />
              <span>Advance Pre-Booking</span>
            </button>
          </div>

          {/* Conflict Banner */}
          {recurringConflicts.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
              <div>
                <span className="font-bold">Slot Occupied on {recurringConflicts[0].date}</span>
                <p className="mt-0.5">
                  {recurringConflicts[0].booking.teacherName} already booked from {formatTime12h(recurringConflicts[0].booking.startTime)} to {formatTime12h(recurringConflicts[0].booking.endTime)}.
                </p>
              </div>
            </div>
          )}

          {/* Date & Time Range Pickers */}
          <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-stone-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-rose-600" />
                  Date:
                </label>
                {!isPrebooking && (
                  <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Day-of Booking Only
                  </span>
                )}
              </div>
              <input
                type="date"
                required
                disabled={!isPrebooking}
                value={isPrebooking ? date : todayStr}
                min={isPrebooking ? todayStr : todayStr}
                max={!isPrebooking ? todayStr : undefined}
                onChange={e => setDate(e.target.value)}
                className={`w-full text-xs p-2.5 rounded-xl border border-stone-300 font-medium focus:ring-2 focus:ring-rose-400 ${
                  !isPrebooking ? 'bg-stone-100 text-stone-600 cursor-not-allowed' : 'bg-white'
                }`}
              />
              {!isPrebooking && (
                <p className="text-[10px] text-stone-500 mt-1">
                  Standard bookings can only be done on the day itself ({todayStr}). Switch to <strong>Advance Pre-Booking</strong> for future dates.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-rose-600" />
                  Start Time:
                </label>
                <select
                  value={startTime}
                  onChange={e => {
                    const newStart = e.target.value;
                    setStartTime(newStart);
                    if (newStart >= endTime) {
                      const [h, m] = newStart.split(':').map(Number);
                      const nextH = Math.min(h + 1, 17);
                      setEndTime(`${nextH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
                    }
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white font-medium focus:ring-2 focus:ring-rose-400"
                >
                  {TIME_OPTIONS.slice(0, -1).map(t => (
                    <option key={t} value={t}>
                      {formatTime12h(t)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-rose-600" />
                  End Time:
                </label>
                <select
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white font-medium focus:ring-2 focus:ring-rose-400"
                >
                  {TIME_OPTIONS.filter(t => t > startTime).map(t => (
                    <option key={t} value={t}>
                      {formatTime12h(t)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-[11px] text-stone-500 font-medium text-right">
              Duration: <span className="font-bold text-stone-800">{durationHours} {durationHours === 1 ? 'hour' : 'hours'}</span>
            </div>
          </div>

          {/* RECURRING OPTION (For Pre-Booking) */}
          {isPrebooking && (
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950 text-xs">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={e => setIsRecurring(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <Repeat className="w-3.5 h-3.5 text-amber-700" />
                <span>Repeat Weekly (Recurring Booking)</span>
              </label>

              {isRecurring && (
                <div className="pt-2 border-t border-amber-200/60 space-y-2">
                  <div className="flex items-center justify-between text-xs text-amber-900 font-medium">
                    <span>Repeats every: <strong>{dayOfWeekName}</strong></span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                      Repeat weekly until (e.g. 21st of November):
                    </label>
                    <input
                      type="date"
                      required={isRecurring}
                      min={date}
                      value={recurringUntil}
                      onChange={e => setRecurringUntil(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-amber-300 bg-white font-medium focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div className="text-[11px] text-amber-800 bg-white/70 p-2 rounded-lg border border-amber-200">
                    🔁 <strong>{recurringDates.length} weekly sessions</strong> will be reserved every {dayOfWeekName} ({formatTime12h(startTime)} - {formatTime12h(endTime)}) until {recurringUntil}.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Teacher Dropdown */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-rose-600" />
              <span>Teacher Name *</span>
            </label>
            {teachersList.length > 0 ? (
              <select
                value={teacherName}
                onChange={e => setTeacherName(e.target.value)}
                required
                className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white font-medium focus:ring-2 focus:ring-rose-400"
              >
                {teachersList.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                No teachers added yet. Please add teachers in the Admin Portal.
              </div>
            )}
          </div>

          {/* Separable Class Group & Subclass Dropdown */}
          {classGroups && classGroups.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Class Group *</span>
                </label>
                <select
                  value={selectedGroupId}
                  onChange={e => {
                    const newGId = e.target.value;
                    setSelectedGroupId(newGId);
                    const grp = classGroups.find(g => g.id === newGId);
                    if (grp && grp.subclasses.length > 0) {
                      setClassName(grp.subclasses[0]);
                    }
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white font-medium focus:ring-2 focus:ring-rose-400"
                >
                  {classGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.subclasses.length})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Class *</span>
                </label>
                <select
                  value={className}
                  onChange={e => setClassName(e.target.value)}
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white font-medium focus:ring-2 focus:ring-rose-400"
                >
                  {groupClasses.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                <span>Class / Student Cohort *</span>
              </label>
              {classesList.length > 0 ? (
                <select
                  value={className}
                  onChange={e => setClassName(e.target.value)}
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white font-medium focus:ring-2 focus:ring-rose-400"
                >
                  {classesList.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-indigo-700 bg-indigo-50 p-2.5 rounded-xl border border-indigo-200">
                  No classes added yet. Please add class groups in the Admin Portal.
                </div>
              )}
            </div>
          )}

          {/* Topic / Activity */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Lesson Topic / Activity Purpose *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., SPM Speaking Practice, Listening Paper Mock, Choral Speaking Rehearsal"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-rose-400"
            />
          </div>

          {/* Pre-Booking note if enabled */}
          {isPrebooking && (
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200">
              <label className="block font-semibold text-amber-900 mb-1">
                Pre-Booking Remarks / Event Scope:
              </label>
              <input
                type="text"
                placeholder="e.g., Advance reservation for upcoming oral examination"
                value={prebookingReason}
                onChange={e => setPrebookingReason(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-amber-300 bg-white focus:ring-2 focus:ring-amber-400"
              />
              <p className="text-[10px] text-amber-700 mt-1">
                ✓ Pre-bookings are directly confirmed without requiring approval.
              </p>
            </div>
          )}

          {/* Teacher Notes */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Remarks (Optional)
            </label>
            <input
              type="text"
              placeholder="Any special notes or preparation..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full text-xs p-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-rose-400"
            />
          </div>

          {/* Telegram Notification Toggle in Pastel */}
          <div className="p-3 rounded-xl bg-sky-50/80 border border-sky-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Send className="w-4 h-4 text-sky-700" />
              <div>
                <span className="font-bold text-sky-950 block">
                  Notify Telegram Group
                </span>
                <span className="text-[11px] text-sky-700">
                  Broadcast to {telegramConfig.groupTitle || 'SAKURA Teachers'}
                </span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifyTelegram}
                onChange={e => setNotifyTelegram(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-stone-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 rounded-xl hover:bg-stone-100 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || recurringConflicts.length > 0 || teachersList.length === 0 || classesList.length === 0}
            className={`px-5 py-2 text-xs font-semibold rounded-xl shadow-2xs transition-all flex items-center gap-1.5 ${
              recurringConflicts.length > 0 || teachersList.length === 0 || classesList.length === 0
                ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                : isPrebooking
                ? 'bg-amber-200 text-amber-950 hover:bg-amber-300'
                : 'bg-rose-200/90 text-rose-950 hover:bg-rose-200 border border-rose-300'
            }`}
          >
            {isSubmitting ? (
              <span>Saving...</span>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>
                  {isPrebooking 
                    ? isRecurring 
                      ? `Pre-Book ${recurringDates.length} Weekly Sessions` 
                      : 'Pre-Book & Send Alert' 
                    : 'Confirm Booking (Today)'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
