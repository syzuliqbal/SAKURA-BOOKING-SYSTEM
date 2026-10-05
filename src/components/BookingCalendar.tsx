import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Users, 
  Plus, 
  Search, 
  Filter, 
  BookmarkPlus,
  ArrowRight
} from 'lucide-react';
import { Booking } from '../types';
import { CALENDAR_HOURS, TIMETABLE_PERIODS, formatTime12h, calculateDurationHours } from '../data/timeSlots';

interface BookingCalendarProps {
  bookings: Booking[];
  schoolLogo?: string | null;
  onSelectBooking: (booking: Booking) => void;
  onQuickBookSlot: (date: string, startTime: string) => void;
  onOpenBookingModal: (isPrebooking?: boolean, date?: string, startTime?: string) => void;
}

type CalendarViewMode = 'week' | 'month' | 'day';

export const BookingCalendar: React.FC<BookingCalendarProps> = ({
  bookings,
  schoolLogo,
  onSelectBooking,
  onQuickBookSlot,
  onOpenBookingModal,
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'regular' | 'prebooking'>('all');

  const formatDateISO = (d: Date) => d.toISOString().split('T')[0];
  const todayStr = formatDateISO(new Date());

  // Week view calculation: Mon-Fri by default; include Saturday/Sunday ONLY if there is a booking on those days
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay(); // 0 is Sunday, 1 is Monday...
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // Monday of current week
    const monday = new Date(curr);
    monday.setDate(diff);

    // Default: Mon (0) to Fri (4)
    const days: Date[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }

    // Check Saturday (5)
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    const satStr = formatDateISO(saturday);
    const hasSatBooking = bookings.some(b => b.status !== 'cancelled' && b.date === satStr);

    // Check Sunday (6)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const sunStr = formatDateISO(sunday);
    const hasSunBooking = bookings.some(b => b.status !== 'cancelled' && b.date === sunStr);

    if (hasSatBooking) {
      days.push(saturday);
    }
    if (hasSunBooking) {
      days.push(sunday);
    }

    return days;
  }, [currentDate, bookings]);

  // Unique teachers
  const teacherList = useMemo(() => {
    const set = new Set<string>();
    bookings.forEach(b => {
      if (b.teacherName) set.add(b.teacherName);
    });
    return Array.from(set).sort();
  }, [bookings]);

  // Filter bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (b.status === 'cancelled') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = b.title.toLowerCase().includes(q);
        const matchTeacher = b.teacherName.toLowerCase().includes(q);
        const matchClass = b.className.toLowerCase().includes(q);
        if (!matchTitle && !matchTeacher && !matchClass) return false;
      }
      if (selectedTeacher !== 'all' && b.teacherName !== selectedTeacher) return false;
      if (selectedFilter === 'prebooking' && !b.isPrebooking) return false;
      if (selectedFilter === 'regular' && b.isPrebooking) return false;
      return true;
    });
  }, [bookings, searchQuery, selectedTeacher, selectedFilter]);

  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') next.setMonth(next.getMonth() - 1);
    else if (viewMode === 'week') next.setDate(next.getDate() - 7);
    else next.setDate(next.getDate() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') next.setMonth(next.getMonth() + 1);
    else if (viewMode === 'week') next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  // Detailed 30-minute status for an hour block
  const getHourSlotStatus = (dateStr: string, hourStr: string) => {
    const [h] = hourStr.split(':').map(Number);
    const hStartMin = h * 60;
    const hMidMin = h * 60 + 30;
    const hEndMin = (h + 1) * 60;
    const timeStr1 = `${h.toString().padStart(2, '0')}:00`;
    const timeStr2 = `${h.toString().padStart(2, '0')}:30`;
    const nextHourStr = `${(h + 1).toString().padStart(2, '0')}:00`;

    const dayBookings = filteredBookings.filter(b => b.date === dateStr);

    // Booking active in first 30 mins (:00 - :30)
    const b1 = dayBookings.find(b => {
      const [sh, sm] = b.startTime.split(':').map(Number);
      const [eh, em] = b.endTime.split(':').map(Number);
      const sMin = sh * 60 + sm;
      const eMin = eh * 60 + em;
      return sMin < hMidMin && eMin > hStartMin;
    });

    // Booking active in second 30 mins (:30 - :00)
    const b2 = dayBookings.find(b => {
      const [sh, sm] = b.startTime.split(':').map(Number);
      const [eh, em] = b.endTime.split(':').map(Number);
      const sMin = sh * 60 + sm;
      const eMin = eh * 60 + em;
      return sMin < hEndMin && eMin > hMidMin;
    });

    const isFullHourSameBooking = Boolean(b1 && b2 && b1.id === b2.id);

    return {
      hourStr,
      hStartMin,
      hMidMin,
      hEndMin,
      timeStr1,
      timeStr2,
      nextHourStr,
      isFullHourSameBooking,
      fullBooking: isFullHourSameBooking ? b1 : undefined,
      slot1Booking: b1,
      slot2Booking: b2,
    };
  };

  // Check if a booking falls within an hour block (for fallback metrics)
  const getBookingsForHourAndDate = (dateStr: string, hourStr: string) => {
    const [h] = hourStr.split(':').map(Number);
    const hourStartMin = h * 60;
    const hourEndMin = (h + 1) * 60;

    return filteredBookings.filter(b => {
      if (b.date !== dateStr) return false;
      const [sh, sm] = b.startTime.split(':').map(Number);
      const [eh, em] = b.endTime.split(':').map(Number);
      const bStartMin = sh * 60 + sm;
      const bEndMin = eh * 60 + em;
      return bStartMin < hourEndMin && bEndMin > hourStartMin;
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xs border border-stone-200 overflow-hidden font-sans">
      {/* Calendar Control Bar in Soft Pastel */}
      <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/70">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Date Range Navigation */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white rounded-xl border border-stone-300 shadow-2xs p-0.5">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors"
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors"
                title="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-stone-800 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-rose-600" />
              {viewMode === 'week' && weekDays.length > 0 && (
                <span>
                  {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
                  {weekDays[weekDays.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              {viewMode === 'month' && (
                <span>{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              )}
              {viewMode === 'day' && (
                <span>{currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
              )}
            </h2>
          </div>

          {/* Quick Actions & View Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[180px] sm:min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search teacher, class..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-stone-300 bg-white text-stone-800 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-rose-400"
              />
            </div>

            {/* View Switcher: Week / Month / Day */}
            <div className="flex bg-stone-200/60 p-0.5 rounded-xl border border-stone-300 text-xs font-medium">
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'week' ? 'bg-white text-stone-800 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'month' ? 'bg-white text-stone-800 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'day' ? 'bg-white text-stone-800 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Day
              </button>
            </div>

            {/* Action Buttons in soft pastel */}
            <button
              onClick={() => onOpenBookingModal(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200/80 transition-colors flex items-center gap-1"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-amber-700" />
              <span>Pre-Book</span>
            </button>

            <button
              onClick={() => onOpenBookingModal(false)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-200/90 text-rose-950 border border-rose-300 hover:bg-rose-200 transition-colors shadow-2xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Book Time</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-stone-200/80 text-xs">
          <div className="flex items-center gap-1 text-stone-500 mr-1 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={selectedTeacher}
            onChange={e => setSelectedTeacher(e.target.value)}
            className="text-xs bg-white border border-stone-300 rounded-lg px-2.5 py-1 text-stone-700"
          >
            <option value="all">All Teachers ({teacherList.length})</option>
            {teacherList.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={selectedFilter}
            onChange={e => setSelectedFilter(e.target.value as any)}
            className="text-xs bg-white border border-stone-300 rounded-lg px-2.5 py-1 text-stone-700"
          >
            <option value="all">All Bookings</option>
            <option value="regular">Standard Bookings</option>
            <option value="prebooking">Advance Pre-Bookings Only</option>
          </select>

          {(selectedTeacher !== 'all' || selectedFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedTeacher('all');
                setSelectedFilter('all');
                setSearchQuery('');
              }}
              className="text-rose-700 hover:text-rose-900 text-xs font-semibold ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* WEEK VIEW (Dates on Left, 30-Min Time Periods on Top) */}
      {viewMode === 'week' && (
        <div>
          <div className="px-3.5 py-2 bg-stone-50 border-b border-stone-200 text-xs text-stone-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>👈 Scroll horizontally to view all 30-min time periods (7:00 AM – 5:00 PM) 👉</span>
            </span>
            <span className="font-semibold text-rose-800">Click any Free box to book</span>
          </div>

          <div className="overflow-x-auto select-none">
            <table className="w-full border-collapse min-w-[2600px] text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  {/* Left Header: Date & Day */}
                  <th className="sticky left-0 z-20 bg-stone-100/95 backdrop-blur-xs py-3 px-3.5 text-left font-bold text-stone-700 w-44 min-w-44 max-w-44 border-r border-stone-200 shadow-xs">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-rose-700" />
                      <span>Date &amp; Day</span>
                    </div>
                  </th>

                  {/* Top Columns: 30-minute Time Periods */}
                  {TIMETABLE_PERIODS.map(period => (
                    <th
                      key={period.startTime}
                      className={`py-2 px-2 text-center border-r border-stone-200 font-semibold min-w-[130px] ${
                        period.isRehat ? 'bg-amber-50/70 text-amber-950' : 'bg-stone-50 text-stone-700'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                        {period.isRehat ? 'Recess / Rehat' : `Period ${period.periodNumber || ''}`}
                      </div>
                      <div className="font-mono text-xs font-bold mt-0.5 text-stone-800">
                        {period.timeLabel}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-200">
                {weekDays.map(day => {
                  const dayStr = formatDateISO(day);
                  const isToday = dayStr === todayStr;
                  const dayBookings = filteredBookings.filter(b => b.date === dayStr);

                  return (
                    <tr
                      key={dayStr}
                      className={`hover:bg-stone-50/30 transition-colors h-24 ${
                        isToday ? 'bg-rose-50/15' : ''
                      }`}
                    >
                      {/* Left Sticky Cell: Day & Date */}
                      <td
                        className={`sticky left-0 z-10 border-r border-stone-200 p-3 w-44 min-w-44 max-w-44 align-middle shadow-xs ${
                          isToday ? 'bg-rose-50/95' : 'bg-white'
                        }`}
                      >
                        <div className="font-bold text-sm text-stone-900 leading-snug">
                          {day.toLocaleDateString('en-US', { weekday: 'long' })}
                        </div>
                        <div className="text-[11px] text-stone-500 font-medium mt-0.5">
                          {day.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        {isToday && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-rose-200/90 text-rose-950 font-bold text-[10px] border border-rose-300">
                            ● Today
                          </span>
                        )}
                      </td>

                      {/* Period Cells with Continuous colSpan for multi-period sessions */}
                      {(() => {
                        const cells: React.ReactNode[] = [];
                        let i = 0;

                        while (i < TIMETABLE_PERIODS.length) {
                          const period = TIMETABLE_PERIODS[i];
                          const [psh, psm] = period.startTime.split(':').map(Number);
                          const [peh, pem] = period.endTime.split(':').map(Number);
                          const pStartMin = psh * 60 + psm;
                          const pEndMin = peh * 60 + pem;

                          const overlappingBooking = dayBookings.find(b => {
                            const [bsh, bsm] = b.startTime.split(':').map(Number);
                            const [beh, bem] = b.endTime.split(':').map(Number);
                            const bStartMin = bsh * 60 + bsm;
                            const bEndMin = beh * 60 + bem;
                            return bStartMin < pEndMin && bEndMin > pStartMin;
                          });

                          if (overlappingBooking) {
                            // Calculate how many periods this booking spans from i
                            let span = 1;
                            while (i + span < TIMETABLE_PERIODS.length) {
                              const nextPeriod = TIMETABLE_PERIODS[i + span];
                              const [nsh, nsm] = nextPeriod.startTime.split(':').map(Number);
                              const [neh, nem] = nextPeriod.endTime.split(':').map(Number);
                              const nStartMin = nsh * 60 + nsm;
                              const nEndMin = neh * 60 + nem;

                              const [bsh, bsm] = overlappingBooking.startTime.split(':').map(Number);
                              const [beh, bem] = overlappingBooking.endTime.split(':').map(Number);
                              const bStartMin = bsh * 60 + bsm;
                              const bEndMin = beh * 60 + bem;

                              if (bStartMin < nEndMin && bEndMin > nStartMin) {
                                span++;
                              } else {
                                break;
                              }
                            }

                            cells.push(
                              <td
                                key={`${dayStr}-${period.startTime}`}
                                colSpan={span}
                                className="p-1.5 border-r border-stone-200 align-middle h-24 min-w-[130px]"
                              >
                                <div
                                  onClick={() => onSelectBooking(overlappingBooking)}
                                  className={`h-full w-full rounded-xl p-2.5 text-left cursor-pointer transition-all border shadow-2xs hover:shadow-xs flex flex-col justify-between overflow-hidden ${
                                    overlappingBooking.isPrebooking
                                      ? 'bg-amber-50/95 border-amber-300 hover:border-amber-400 text-amber-950'
                                      : 'bg-teal-50/95 border-teal-300 hover:border-teal-400 text-teal-950'
                                  }`}
                                >
                                  <div className="flex items-center justify-between leading-none gap-1">
                                    <span className="font-bold text-xs truncate">
                                      {overlappingBooking.className}
                                    </span>
                                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-black/5 shrink-0 ml-1">
                                      {formatTime12h(overlappingBooking.startTime)} - {formatTime12h(overlappingBooking.endTime)}
                                    </span>
                                  </div>
                                  <div className="text-[11px] font-medium text-stone-800 truncate line-clamp-1 my-1" title={overlappingBooking.title}>
                                    {overlappingBooking.title}
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-stone-600 leading-none">
                                    <span className="truncate font-semibold">{overlappingBooking.teacherName}</span>
                                    {overlappingBooking.isPrebooking && (
                                      <span title="Advance Pre-booking" className="shrink-0 text-amber-800 flex items-center gap-0.5 font-bold">
                                        <BookmarkPlus className="w-3 h-3" />
                                        <span>Pre-book</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            );

                            i += span;
                          } else {
                            // Free slot box
                            cells.push(
                              <td
                                key={`${dayStr}-${period.startTime}`}
                                colSpan={1}
                                className={`p-1.5 border-r border-stone-200 align-middle h-24 min-w-[130px] ${
                                  period.isRehat ? 'bg-amber-50/20' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => onQuickBookSlot(dayStr, period.startTime)}
                                  className="w-full h-full rounded-xl border border-dashed border-stone-200 hover:border-emerald-500 hover:bg-emerald-50/50 flex flex-col items-center justify-center gap-1 text-stone-400 hover:text-emerald-800 transition-all group p-1 shadow-2xs"
                                  title={`Available: Book ${period.timeLabel} on ${dayStr}`}
                                >
                                  <Plus className="w-4 h-4 group-hover:scale-110 transition-transform text-stone-400 group-hover:text-emerald-700" />
                                  <span className="text-[10px] font-bold">
                                    {period.isRehat ? 'Rehat (Free)' : 'Available'}
                                  </span>
                                </button>
                              </td>
                            );

                            i++;
                          }
                        }

                        return cells;
                      })()}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-7 gap-px bg-stone-200 rounded-xl overflow-hidden border border-stone-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="bg-stone-100 p-2 text-center text-xs font-bold text-stone-600">
                {d}
              </div>
            ))}

            {(() => {
              const year = currentDate.getFullYear();
              const month = currentDate.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const cells = [];

              for (let i = 0; i < firstDay; i++) {
                cells.push(
                  <div key={`blank-${i}`} className="bg-stone-50/40 min-h-[90px] p-1.5 opacity-30"></div>
                );
              }

              for (let d = 1; d <= daysInMonth; d++) {
                const dateObj = new Date(year, month, d);
                const dStr = formatDateISO(dateObj);
                const isToday = dStr === todayStr;
                const dayBookings = filteredBookings.filter(b => b.date === dStr);

                cells.push(
                  <div
                    key={dStr}
                    onClick={() => {
                      setCurrentDate(dateObj);
                      setViewMode('day');
                    }}
                    className={`bg-white min-h-[95px] p-2 transition-colors cursor-pointer hover:bg-stone-50 flex flex-col justify-between ${
                      isToday ? 'ring-2 ring-rose-300 ring-inset bg-rose-50/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isToday ? 'text-rose-700' : 'text-stone-700'}`}>
                        {d}
                      </span>
                      {dayBookings.length > 0 && (
                        <span className="text-[10px] font-bold bg-stone-100 text-stone-700 px-1.5 py-0.2 rounded-full">
                          {dayBookings.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 mt-1 flex-1 overflow-y-auto max-h-16 scrollbar-none">
                      {dayBookings.slice(0, 3).map(b => (
                        <div
                          key={b.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBooking(b);
                          }}
                          className={`text-[10px] p-1 rounded font-medium truncate ${
                            b.isPrebooking
                              ? 'bg-amber-50 text-amber-900 border border-amber-200'
                              : 'bg-teal-50 text-teal-900 border border-teal-200'
                          }`}
                          title={`${formatTime12h(b.startTime)}: ${b.title} (${b.teacherName})`}
                        >
                          <span className="font-bold">{formatTime12h(b.startTime)}:</span> {b.teacherName}
                        </div>
                      ))}
                      {dayBookings.length > 3 && (
                        <div className="text-[9px] text-stone-500 text-center font-medium">
                          +{dayBookings.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return cells;
            })()}
          </div>
        </div>
      )}

      {/* DAY VIEW (Accurate 30-Minute Schedule) */}
      {viewMode === 'day' && (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between bg-stone-50 p-4 rounded-xl border border-stone-200 shadow-2xs">
            <div>
              <h3 className="font-bold text-stone-800 text-base">
                {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Accurate 30-minute interval timetable for English Language Lab
              </p>
            </div>
            <button
              onClick={() => {
                const dStr = formatDateISO(currentDate);
                const todayStr = formatDateISO(new Date());
                onOpenBookingModal(dStr > todayStr, dStr);
              }}
              className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-rose-200/90 text-rose-950 hover:bg-rose-200 inline-flex items-center gap-1.5 shadow-2xs border border-rose-300"
            >
              <Plus className="w-3.5 h-3.5" /> Book on this Day
            </button>
          </div>

          <div className="space-y-3">
            {CALENDAR_HOURS.map(hour => {
              const dStr = formatDateISO(currentDate);
              const status = getHourSlotStatus(dStr, hour);

              return (
                <div
                  key={hour}
                  className="p-3.5 rounded-2xl border border-stone-200 bg-white shadow-2xs space-y-2.5"
                >
                  {/* Hour Header */}
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <span className="font-mono font-bold text-xs text-stone-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      <span>{formatTime12h(hour)} – {formatTime12h(status.nextHourStr)}</span>
                    </span>
                    {status.isFullHourSameBooking ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                        1-Hour Session
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-400 font-medium">
                        30-minute intervals
                      </span>
                    )}
                  </div>

                  {status.isFullHourSameBooking && status.fullBooking ? (
                    /* Unified Full 1-Hour Session */
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200 gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-stone-900">
                            {status.fullBooking.className}
                          </span>
                          <span className="font-mono text-xs text-stone-600 bg-white px-2 py-0.5 rounded border border-stone-200">
                            {formatTime12h(status.fullBooking.startTime)} - {formatTime12h(status.fullBooking.endTime)}
                          </span>
                          {status.fullBooking.isPrebooking && (
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                              Pre-Booked
                            </span>
                          )}
                        </div>
                        <h4
                          onClick={() => onSelectBooking(status.fullBooking!)}
                          className="font-semibold text-xs text-stone-800 hover:text-rose-700 cursor-pointer"
                        >
                          {status.fullBooking.title}
                        </h4>
                        <p className="text-[11px] text-stone-500">
                          Instructor: <strong>{status.fullBooking.teacherName}</strong>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectBooking(status.fullBooking!)}
                        className="text-xs font-semibold text-rose-700 hover:text-rose-900 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 transition-colors self-start sm:self-auto shrink-0"
                      >
                        View Details
                      </button>
                    </div>
                  ) : (
                    /* Dual 30-Minute Breakdowns */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* 1st Half: :00 - :30 */}
                      <div className="p-2.5 rounded-xl border border-stone-200 bg-stone-50/50">
                        <div className="text-[10px] font-mono text-stone-500 font-semibold mb-1 flex items-center justify-between">
                          <span>{formatTime12h(status.timeStr1)} - {formatTime12h(status.timeStr2)}</span>
                          {status.slot1Booking ? (
                            <span className="font-bold text-stone-700">Booked</span>
                          ) : (
                            <span className="font-bold text-emerald-700">Available</span>
                          )}
                        </div>

                        {status.slot1Booking ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-stone-900">{status.slot1Booking.className}</span>
                              <button
                                type="button"
                                onClick={() => onSelectBooking(status.slot1Booking!)}
                                className="text-[11px] text-rose-700 font-semibold hover:underline"
                              >
                                View
                              </button>
                            </div>
                            <p className="text-[11px] text-stone-700 font-medium truncate" title={status.slot1Booking.title}>
                              {status.slot1Booking.title}
                            </p>
                            <p className="text-[10px] text-stone-500">
                              {status.slot1Booking.teacherName} • <span className="font-mono">{formatTime12h(status.slot1Booking.startTime)}-{formatTime12h(status.slot1Booking.endTime)}</span>
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-emerald-700">Free (30 mins)</span>
                            <button
                              type="button"
                              onClick={() => onQuickBookSlot(dStr, status.timeStr1)}
                              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 transition-colors flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Book 30m
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 2nd Half: :30 - :00 */}
                      <div className="p-2.5 rounded-xl border border-stone-200 bg-stone-50/50">
                        <div className="text-[10px] font-mono text-stone-500 font-semibold mb-1 flex items-center justify-between">
                          <span>{formatTime12h(status.timeStr2)} - {formatTime12h(status.nextHourStr)}</span>
                          {status.slot2Booking ? (
                            <span className="font-bold text-stone-700">Booked</span>
                          ) : (
                            <span className="font-bold text-emerald-700">Available</span>
                          )}
                        </div>

                        {status.slot2Booking ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-stone-900">{status.slot2Booking.className}</span>
                              <button
                                type="button"
                                onClick={() => onSelectBooking(status.slot2Booking!)}
                                className="text-[11px] text-rose-700 font-semibold hover:underline"
                              >
                                View
                              </button>
                            </div>
                            <p className="text-[11px] text-stone-700 font-medium truncate" title={status.slot2Booking.title}>
                              {status.slot2Booking.title}
                            </p>
                            <p className="text-[10px] text-stone-500">
                              {status.slot2Booking.teacherName} • <span className="font-mono">{formatTime12h(status.slot2Booking.startTime)}-{formatTime12h(status.slot2Booking.endTime)}</span>
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-emerald-700">Free (30 mins)</span>
                            <button
                              type="button"
                              onClick={() => onQuickBookSlot(dStr, status.timeStr2)}
                              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 transition-colors flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Book 30m
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
