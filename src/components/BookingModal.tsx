import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Repeat,
  Check,
  Sparkles
} from 'lucide-react';
import { Booking, TelegramConfig, ClassGroup } from '../types';
import { TIME_OPTIONS, TIMETABLE_PERIODS, formatTime12h, calculateDurationHours, DEFAULT_PURPOSES } from '../data/timeSlots';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (bookingData: Partial<Booking>, sendTelegram: boolean, recurringDates?: string[]) => Promise<void>;
  existingBookings: Booking[];
  teachersList: string[];
  classesList: string[];
  classGroups?: ClassGroup[];
  purposesList?: string[];
  initialDate?: string;
  initialStartTime?: string;
  initialIsPrebooking?: boolean;
  onModeChange?: (isPrebooking: boolean) => void;
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
  purposesList = [],
  initialDate,
  initialStartTime,
  initialIsPrebooking = false,
  onModeChange,
  telegramConfig,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  // Available purposes
  const availablePurposes = useMemo(() => {
    return purposesList && purposesList.length > 0 ? purposesList : DEFAULT_PURPOSES;
  }, [purposesList]);

  // If opening for a future date, default to isPrebooking = true
  const [isPrebooking, setIsPrebooking] = useState(() => {
    if (initialDate && initialDate > todayStr) return true;
    return initialIsPrebooking;
  });

  const [selectedPurpose, setSelectedPurpose] = useState<string>(() => {
    return availablePurposes[0] || 'Teaching and Learning (PdPc)';
  });
  const [customPurpose, setCustomPurpose] = useState('');

  const [selectedTeacher, setSelectedTeacher] = useState<string>(() => {
    return teachersList[0] || '__custom__';
  });
  const [customTeacher, setCustomTeacher] = useState('');
  const [date, setDate] = useState(() => {
    if (initialIsPrebooking || (initialDate && initialDate > todayStr)) {
      return initialDate || todayStr;
    }
    return initialDate || todayStr;
  });
  const [startTime, setStartTime] = useState(initialStartTime || '');
  const [endTime, setEndTime] = useState(() => {
    if (initialStartTime) {
      const [h, m] = initialStartTime.split(':').map(Number);
      const endTotalMin = Math.min(h * 60 + m + 30, 17 * 60);
      const endH = Math.floor(endTotalMin / 60).toString().padStart(2, '0');
      const endM = (endTotalMin % 60).toString().padStart(2, '0');
      return `${endH}:${endM}`;
    }
    return '';
  });

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
    const d = new Date();
    d.setDate(d.getDate() + 42); // 6 weeks ahead
    return d.toISOString().split('T')[0];
  });

  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Track open state so that background data syncs NEVER reset user inputs while modal is open
  const wasOpenRef = useRef(false);

  // Sync initial props ONCE on modal open
  useEffect(() => {
    if (isOpen) {
      if (!wasOpenRef.current) {
        wasOpenRef.current = true;

        let shouldPrebook = false;
        if (initialDate && initialDate > todayStr) {
          shouldPrebook = true;
          setDate(initialDate);
        } else if (initialIsPrebooking) {
          shouldPrebook = true;
          const tmrw = new Date();
          tmrw.setDate(tmrw.getDate() + 1);
          setDate(initialDate && initialDate > todayStr ? initialDate : tmrw.toISOString().split('T')[0]);
        } else {
          shouldPrebook = false;
          setDate(initialDate || todayStr);
        }

        setIsPrebooking(shouldPrebook);

        if (initialStartTime) {
          setStartTime(initialStartTime);
          const [h, m] = initialStartTime.split(':').map(Number);
          const endTotalMin = Math.min(h * 60 + m + 30, 17 * 60);
          const endH = Math.floor(endTotalMin / 60).toString().padStart(2, '0');
          const endM = (endTotalMin % 60).toString().padStart(2, '0');
          setEndTime(`${endH}:${endM}`);
        } else {
          setStartTime('');
          setEndTime('');
        }

        if (teachersList.length > 0) {
          setSelectedTeacher(prev => prev && (teachersList.includes(prev) || prev === '__custom__') ? prev : teachersList[0]);
        } else {
          setSelectedTeacher('__custom__');
        }
        setCustomTeacher('');
        setCustomPurpose('');
        setFormError('');
        if (classGroups.length > 0) {
          const activeGrp = classGroups.find(g => g.id === selectedGroupId) || classGroups[0];
          setSelectedGroupId(activeGrp.id);
          setClassName(activeGrp.subclasses[0] || '');
        }
        if (availablePurposes.length > 0) {
          setSelectedPurpose(prev => prev || availablePurposes[0]);
        }
      }
    } else {
      wasOpenRef.current = false;
    }
  }, [isOpen, initialStartTime, initialDate, initialIsPrebooking]);

  // Handle switching booking mode
  const handleModeSwitch = (prebookingMode: boolean) => {
    setIsPrebooking(prebookingMode);
    onModeChange?.(prebookingMode);

    if (!prebookingMode) {
      // Normal booking allows today or backdated dates. If currently on a future date, reset to today.
      if (date > todayStr) {
        setDate(todayStr);
      }
      setIsRecurring(false);
    } else {
      // Pre-booking is for oncoming/future dates: advance to tomorrow if currently today or in the past
      if (date <= todayStr) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setDate(tomorrow.toISOString().split('T')[0]);
      }
    }
  };

  // Selected date for checking availability
  const effectiveDate = date;

  // Real-time slot availability for effectiveDate
  const daySlotAvailability = useMemo(() => {
    const activeBookingsOnDate = existingBookings.filter(
      b => b.status !== 'cancelled' && b.date === effectiveDate
    );

    const hasSelection = Boolean(
      startTime && endTime && startTime.includes(':') && endTime.includes(':')
    );
    const [selStartH, selStartM] = hasSelection ? startTime.split(':').map(Number) : [0, 0];
    const [selEndH, selEndM] = hasSelection ? endTime.split(':').map(Number) : [0, 0];
    const selStartMin = hasSelection ? selStartH * 60 + selStartM : -1;
    const selEndMin = hasSelection ? selEndH * 60 + selEndM : -1;

    return TIMETABLE_PERIODS.map(period => {
      const [psh, psm] = period.startTime.split(':').map(Number);
      const [peh, pem] = period.endTime.split(':').map(Number);
      const pStartMin = psh * 60 + psm;
      const pEndMin = peh * 60 + pem;

      const overlapping = activeBookingsOnDate.find(b => {
        const [bsh, bsm] = b.startTime.split(':').map(Number);
        const [beh, bem] = b.endTime.split(':').map(Number);
        const bStartMin = bsh * 60 + bsm;
        const bEndMin = beh * 60 + bem;
        return bStartMin < pEndMin && bEndMin > pStartMin;
      });

      const isSelected = hasSelection && pStartMin >= selStartMin && pEndMin <= selEndMin;
      const isAdjacent =
        hasSelection &&
        !isSelected &&
        !overlapping &&
        (period.startTime === endTime || period.endTime === startTime);

      return {
        period,
        isBooked: Boolean(overlapping),
        booking: overlapping,
        isSelected,
        isAdjacent,
        pStartMin,
        pEndMin,
      };
    });
  }, [effectiveDate, existingBookings, startTime, endTime]);

  // Click handler for timing box: user can tap and untap slots to pick and unpick
  const handleBoxClick = (clickedStartTime: string, clickedEndTime: string) => {
    // If no slot is selected, picking this slot selects ONLY this single 30-min slot
    if (!startTime || !endTime) {
      setStartTime(clickedStartTime);
      setEndTime(clickedEndTime);
      return;
    }

    const [curSH, curSM] = startTime.split(':').map(Number);
    const [curEH, curEM] = endTime.split(':').map(Number);
    const curStartMin = curSH * 60 + curSM;
    const curEndMin = curEH * 60 + curEM;

    const [clkSH, clkSM] = clickedStartTime.split(':').map(Number);
    const [clkEH, clkEM] = clickedEndTime.split(':').map(Number);
    const clkStartMin = clkSH * 60 + clkSM;
    const clkEndMin = clkEH * 60 + clkEM;

    // Check if the clicked slot is inside the current selected range
    const isInsideSelection = clkStartMin >= curStartMin && clkEndMin <= curEndMin;

    if (isInsideSelection) {
      // --- UNPICK / UNTAP LOGIC ---
      // Check if this is the only slot currently selected (30 mins)
      if (curEndMin - curStartMin <= 30) {
        // Untap the single selected slot -> clears selection completely
        setStartTime('');
        setEndTime('');
        return;
      }

      // Multiple slots currently selected:
      if (clkStartMin === curStartMin) {
        // Untap the earliest slot -> shrink start time forward
        setStartTime(clickedEndTime);
        return;
      }

      if (clkEndMin === curEndMin) {
        // Untap the latest slot -> shrink end time backward
        setEndTime(clickedStartTime);
        return;
      }

      // Untapping a middle slot: trim the range so it ends at this slot (leaving the earlier portion)
      setEndTime(clickedStartTime);
      return;
    }

    // --- PICK / EXTEND LOGIC ---
    // Check if clicked slot is immediately adjacent to the current selection:
    if (clickedStartTime === endTime) {
      // Immediately adjacent at the end: extend range forward!
      setEndTime(clickedEndTime);
      return;
    }

    if (clickedEndTime === startTime) {
      // Immediately adjacent at the start: extend range backward!
      setStartTime(clickedStartTime);
      return;
    }

    // Non-adjacent slot clicked: switch selection cleanly to ONLY this newly clicked slot!
    // (Prevents automatically picking more slots than clicked)
    setStartTime(clickedStartTime);
    setEndTime(clickedEndTime);
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

    const finalPurpose = selectedPurpose === '__custom__' ? customPurpose.trim() : selectedPurpose.trim();
    const finalTeacherName = selectedTeacher === '__custom__' ? customTeacher.trim() : selectedTeacher.trim();

    if (teachersList.length === 0 && selectedTeacher !== '__custom__') {
      setFormError('Please select or specify a teacher name.');
      return;
    }
    if (classesList.length === 0) {
      setFormError('No classes available. Please add classes in the Admin Portal first.');
      return;
    }
    if (!finalPurpose) {
      setFormError('Please select or specify an activity purpose.');
      return;
    }
    if (!finalTeacherName) {
      setFormError('Please select a teacher or write the teacher name manually.');
      return;
    }
    if (!className) {
      setFormError('Please select a class.');
      return;
    }
    if (!startTime || !endTime || startTime >= endTime) {
      setFormError('Please click an available time slot box to choose your booking time.');
      return;
    }
    if (!isPrebooking && date > todayStr) {
      setFormError('Normal bookings can only be done for today or past dates (backdated). For oncoming future dates, please use Advance Pre-Booking.');
      return;
    }
    if (isPrebooking && date < todayStr) {
      setFormError('Advance Pre-Bookings are for oncoming / future dates. For past dates, please use Normal Booking.');
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
        title: finalPurpose,
        teacherName: finalTeacherName,
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
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-stone-200 my-6 animate-in fade-in zoom-in duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-stone-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isPrebooking ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {isPrebooking ? <BookmarkPlus className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                {isPrebooking ? 'Advance Pre-Booking' : 'Normal Lab Booking (Today / Backdated)'}
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
              <span>Normal Booking (Today / Backdated)</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeSwitch(true)}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                isPrebooking ? 'bg-white text-amber-950 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-amber-700" />
              <span>Advance Pre-Booking (Future)</span>
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

          {/* Date & Interactive Timing Boxes (Without Duration or Start/End Time Dropdowns) */}
          <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-stone-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-rose-600" />
                  <span>Date:</span>
                </label>
                {!isPrebooking ? (
                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Today or Backdated Log
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Future Dates Only
                  </span>
                )}
              </div>
              <input
                type="date"
                required
                value={date}
                max={!isPrebooking ? todayStr : undefined}
                min={isPrebooking ? todayStr : undefined}
                onChange={e => setDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white font-medium focus:ring-2 focus:ring-rose-400"
              />
              {!isPrebooking ? (
                <p className="text-[10px] text-stone-500 mt-1">
                  Normal bookings can be recorded for <strong>today or past dates (backdated)</strong>. For future dates, please switch to <strong>Advance Pre-Booking</strong> above.
                </p>
              ) : (
                <p className="text-[10px] text-stone-500 mt-1">
                  Advance Pre-Bookings can only be scheduled for <strong>oncoming / future dates</strong>.
                </p>
              )}
            </div>

            {/* Interactive Timetable Boxes Grid */}
            <div className="pt-2 border-t border-stone-200/80 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-rose-700" />
                  <span>Timings &amp; Availability for {effectiveDate}:</span>
                </label>
                <div className="flex items-center gap-2 text-[10px] text-stone-500 font-medium">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span>
                    <span>Available</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block"></span>
                    <span>Taken</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-rose-900 inline-block"></span>
                    <span>Selected</span>
                  </span>
                </div>
              </div>

              {/* Selected Time Indicator Banner */}
              {startTime && endTime ? (
                <div className="p-2.5 rounded-xl bg-white border border-stone-200 shadow-2xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold text-stone-700">
                      Selected Time: <strong className="text-stone-900">{formatTime12h(startTime)} – {formatTime12h(endTime)}</strong> ({durationHours} {durationHours === 1 ? 'hour' : 'hours'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStartTime('');
                        setEndTime('');
                      }}
                      className="text-[11px] font-bold text-rose-700 hover:text-rose-900 px-2 py-0.5 rounded-md hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                      title="Clear slot selection"
                    >
                      ✕ Unpick All
                    </button>
                    <span className="text-[10px] font-medium text-stone-500 hidden sm:inline">
                      Tap a picked slot to unpick
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-medium">
                      No time slot selected yet. <strong>Tap any available 30-minute box below</strong> to pick your session.
                    </span>
                  </div>
                </div>
              )}

              {/* Timetable Boxes Grid in 30-min intervals (Part of the main scrollable page) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 bg-stone-100/70 rounded-xl border border-stone-200">
                {daySlotAvailability.map(({ period, isBooked, booking, isSelected, isAdjacent }) => {
                  if (isBooked && booking) {
                    return (
                      <div
                        key={period.startTime}
                        className="p-2.5 rounded-xl border border-rose-300 bg-rose-50/90 text-rose-950 text-left select-none relative shadow-2xs opacity-90 cursor-not-allowed flex flex-col justify-between min-h-[76px]"
                        title={`Taken by ${booking.teacherName} for ${booking.className}: ${booking.title}`}
                      >
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-bold leading-none mb-1">
                            <span className="font-mono">{period.timeLabel}</span>
                            <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300">
                              Taken
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-stone-900 truncate">
                            {booking.className}
                          </div>
                          <div className="text-[10px] text-rose-800 font-semibold truncate mt-0.5">
                            👤 {booking.teacherName}
                          </div>
                        </div>
                        <div className="text-[9px] text-stone-600 truncate mt-1 italic">
                          {booking.title}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={period.startTime}
                      type="button"
                      onClick={() => handleBoxClick(period.startTime, period.endTime)}
                      className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between min-h-[76px] ${
                        isSelected
                          ? 'bg-rose-900 text-white border-rose-950 shadow-md ring-2 ring-rose-400'
                          : isAdjacent
                          ? 'bg-emerald-50 text-stone-800 border-emerald-400 hover:bg-emerald-100 shadow-2xs'
                          : 'bg-white text-stone-800 border-stone-300 hover:border-emerald-500 hover:bg-emerald-50/70 shadow-2xs hover:shadow-xs'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-bold leading-none mb-1">
                          <span className="font-mono">{period.timeLabel}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected 
                              ? 'bg-white/20 text-white' 
                              : isAdjacent
                              ? 'bg-emerald-200 text-emerald-950 border border-emerald-300'
                              : period.isRehat 
                              ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}>
                            {isSelected ? '✓ Picked' : isAdjacent ? '+ Extend' : period.isRehat ? 'Rehat' : 'Free'}
                          </span>
                        </div>
                        <div className={`text-[11px] font-bold truncate ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                          {period.isRehat ? 'Recess / Rehat' : `Period ${period.periodNumber || ''}`}
                        </div>
                      </div>
                      <div className={`text-[10px] font-semibold mt-1 flex items-center justify-between ${
                        isSelected ? 'text-rose-100' : isAdjacent ? 'text-emerald-800 font-bold' : 'text-emerald-700'
                      }`}>
                        <span>{isSelected ? 'Tap to unpick' : isAdjacent ? '+ Tap to extend' : 'Tap to pick'}</span>
                        {isSelected && <span className="text-[10px] text-white/80">✕</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
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

          {/* Teacher Selection (Dropdown with '+ Others' manual entry) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-stone-700 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-rose-600" />
                <span>Teacher Name *</span>
              </label>
              {selectedTeacher === '__custom__' && (
                <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Manual Entry
                </span>
              )}
            </div>

            <select
              value={selectedTeacher}
              onChange={e => setSelectedTeacher(e.target.value)}
              required
              className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white font-medium focus:ring-2 focus:ring-rose-400"
            >
              {teachersList.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
              <option value="__custom__">+ Others (Write name manually)...</option>
            </select>

            {selectedTeacher === '__custom__' && (
              <div className="mt-2 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                <input
                  type="text"
                  required
                  placeholder="Type teacher name manually (e.g. Cikgu Sarah / Mr. David)..."
                  value={customTeacher}
                  onChange={e => setCustomTeacher(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-amber-300 bg-white font-medium focus:ring-2 focus:ring-rose-400 focus:border-rose-400 placeholder:text-stone-400"
                  autoFocus
                />
                <p className="text-[10px] text-stone-500">
                  ✏️ Write the teacher or facilitator's name manually for this booking.
                </p>
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

          {/* Activity Purpose Dropdown (Editable via Admin Page) */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Activity Purpose *</span>
            </label>
            <select
              value={selectedPurpose}
              onChange={e => setSelectedPurpose(e.target.value)}
              required
              className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white font-medium focus:ring-2 focus:ring-rose-400"
            >
              {availablePurposes.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
              <option value="__custom__">+ Other / Custom Purpose...</option>
            </select>

            {selectedPurpose === '__custom__' && (
              <input
                type="text"
                required
                placeholder="Type custom activity purpose..."
                value={customPurpose}
                onChange={e => setCustomPurpose(e.target.value)}
                className="mt-2 w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white font-medium focus:ring-2 focus:ring-rose-400"
              />
            )}
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

          {/* Notes */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Additional Notes / Lab Requirements (Optional):
            </label>
            <textarea
              rows={2}
              placeholder="e.g., Need 30 headsets and projector switched on before 8:00 AM"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-rose-400"
            />
          </div>

          {/* Telegram Notification Toggle */}
          {telegramConfig.enabled && (
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-sky-600 shrink-0" />
                <div>
                  <div className="font-semibold text-xs text-sky-950">
                    Telegram Notification
                  </div>
                  <div className="text-[10px] text-sky-700 flex flex-wrap items-center gap-1">
                    <span>Dispatch instant booking alert to <strong>{telegramConfig.groupTitle || 'Teachers Group'}</strong></span>
                    {telegramConfig.threadId && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-200/70 text-sky-900 border border-sky-300">
                        Topic #{telegramConfig.threadId}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyTelegram}
                  onChange={e => setNotifyTelegram(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
              </label>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 ${
                isPrebooking 
                  ? 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300' 
                  : 'bg-rose-900 hover:bg-rose-950 disabled:bg-rose-400'
              }`}
            >
              {isSubmitting ? (
                <span>Confirming...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>
                    {isPrebooking 
                      ? (isRecurring ? `Confirm ${recurringDates.length} Pre-Bookings` : 'Confirm Pre-Booking') 
                      : 'Confirm Booking'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
