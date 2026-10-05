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
import { CALENDAR_HOURS, formatTime12h, calculateDurationHours } from '../data/timeSlots';

interface BookingCalendarProps {
  bookings: Booking[];
  onSelectBooking: (booking: Booking) => void;
  onQuickBookSlot: (date: string, startTime: string) => void;
  onOpenBookingModal: (isPrebooking?: boolean) => void;
}

type CalendarViewMode = 'week' | 'month' | 'day';

export const BookingCalendar: React.FC<BookingCalendarProps> = ({
  bookings,
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

  // Check if a booking falls within an hour block (e.g., starts at or overlaps with hour)
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
      // Overlaps with this hour window:
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

      {/* WEEK VIEW (Fixed Grid Dimensions) */}
      {viewMode === 'week' && (
        <div>
          <div className="lg:hidden px-3.5 py-1.5 bg-stone-50 border-b border-stone-200 text-[11px] text-stone-500 flex items-center justify-between">
            <span>👈 Swipe horizontally to view week 👉</span>
            <span className="font-semibold text-rose-800">Tap slot to book</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table-fixed w-full border-collapse min-w-[750px] sm:min-w-[850px] text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="py-2.5 px-3 text-left font-bold text-stone-600 w-20 min-w-20 max-w-20 border-r border-stone-200">
                  Time
                </th>
                {weekDays.map(day => {
                  const dayStr = formatDateISO(day);
                  const isToday = dayStr === todayStr;
                  return (
                    <th
                      key={dayStr}
                      style={{ width: `calc((100% - 5rem) / ${weekDays.length})` }}
                      className={`py-2 px-2 text-center font-semibold border-r border-stone-200 last:border-r-0 min-w-[110px] ${
                        isToday ? 'bg-rose-50/70 text-rose-950 font-bold' : 'text-stone-700'
                      }`}
                    >
                      <div className="text-[11px] uppercase tracking-wider text-stone-400">
                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="text-sm font-bold mt-0.5 flex items-center justify-center gap-1">
                        <span>{day.getDate()}</span>
                        {isToday && (
                          <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {CALENDAR_HOURS.map(hour => {
                return (
                  <tr key={hour} className="hover:bg-stone-50/30 h-[76px] max-h-[76px]">
                    {/* Time Label on left */}
                    <td className="py-2.5 px-2.5 border-r border-stone-200 bg-stone-50/60 align-top w-20 min-w-20 max-w-20 h-[76px] max-h-[76px]">
                      <span className="font-mono text-stone-500 font-semibold text-[11px] block">
                        {formatTime12h(hour)}
                      </span>
                    </td>

                    {/* Day Column Cells */}
                    {weekDays.map(day => {
                      const dayStr = formatDateISO(day);
                      const isToday = dayStr === todayStr;
                      const hourBookings = getBookingsForHourAndDate(dayStr, hour);

                      return (
                        <td
                          key={dayStr}
                          style={{ width: `calc((100% - 5rem) / ${weekDays.length})` }}
                          className={`p-1 border-r border-stone-200 last:border-r-0 align-top min-w-[110px] h-[76px] max-h-[76px] transition-colors relative overflow-hidden ${
                            isToday ? 'bg-rose-50/15' : ''
                          }`}
                        >
                          <div className="h-full w-full overflow-hidden flex flex-col justify-start">
                            {hourBookings.length > 0 ? (
                              <div className="h-full flex flex-col gap-1 overflow-hidden">
                                {hourBookings.slice(0, 1).map(booking => {
                                  return (
                                    <div
                                      key={booking.id}
                                      onClick={() => onSelectBooking(booking)}
                                      className={`h-full max-h-[66px] rounded-xl p-1.5 text-left cursor-pointer transition-all border shadow-2xs hover:shadow-xs flex flex-col justify-between overflow-hidden ${
                                        booking.isPrebooking
                                          ? 'bg-amber-50/95 border-amber-200 hover:border-amber-300'
                                          : 'bg-teal-50/95 border-teal-200 hover:border-teal-300'
                                      }`}
                                    >
                                      {/* 1. Class First */}
                                      <div className="flex items-center justify-between leading-none">
                                        <span className="font-bold text-stone-900 text-[11px] truncate">
                                          {booking.className}
                                        </span>
                                        {booking.isPrebooking && (
                                          <span title="Advance Pre-booking" className="shrink-0 ml-0.5">
                                            <BookmarkPlus className="w-3 h-3 text-amber-700" />
                                          </span>
                                        )}
                                      </div>

                                      {/* 2. Reason for booking */}
                                      <div className="text-[10px] text-stone-700 truncate leading-tight font-medium" title={booking.title}>
                                        {booking.title}
                                      </div>

                                      {/* 3. Name of the teacher */}
                                      <div className="text-[10px] text-stone-500 truncate leading-none">
                                        {booking.teacherName}
                                      </div>
                                    </div>
                                  );
                                })}

                                {hourBookings.length > 1 && (
                                  <div className="text-[9px] font-bold text-stone-500 text-center bg-stone-100 rounded py-0.5">
                                    +{hourBookings.length - 1} more
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Clickable Empty Time Slot */
                              <button
                                onClick={() => onQuickBookSlot(dayStr, hour)}
                                className="w-full h-full max-h-[66px] rounded-xl border border-dashed border-stone-200 hover:border-rose-300 hover:bg-rose-50/30 flex items-center justify-center text-stone-300 hover:text-rose-700 transition-all opacity-20 hover:opacity-100 p-1"
                                title={`Book English Lab starting at ${formatTime12h(hour)} on ${dayStr}`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
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

      {/* DAY VIEW */}
      {viewMode === 'day' && (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-3">
          <div className="flex items-center justify-between bg-stone-50 p-3.5 rounded-xl border border-stone-200">
            <div>
              <h3 className="font-bold text-stone-800 text-base">
                {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <p className="text-xs text-stone-500">English Language Lab Daily Schedule</p>
            </div>
            <button
              onClick={() => onQuickBookSlot(formatDateISO(currentDate), '07:00')}
              className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-rose-200/90 text-rose-950 hover:bg-rose-200 inline-flex items-center gap-1.5 shadow-2xs border border-rose-300"
            >
              <Plus className="w-3.5 h-3.5" /> Book on this Day
            </button>
          </div>

          <div className="space-y-2">
            {CALENDAR_HOURS.map(hour => {
              const dStr = formatDateISO(currentDate);
              const hourBookings = getBookingsForHourAndDate(dStr, hour);

              return (
                <div
                  key={hour}
                  className={`p-3 rounded-xl border transition-all ${
                    hourBookings.length > 0
                      ? 'bg-white border-stone-200 shadow-2xs'
                      : 'bg-stone-50/30 border-dashed border-stone-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-24 shrink-0">
                        <span className="font-mono text-stone-500 font-semibold text-xs block">
                          {formatTime12h(hour)}
                        </span>
                      </div>

                      {hourBookings.length > 0 ? (
                        <div className="space-y-2 flex-1">
                          {hourBookings.map(b => (
                            <div key={b.id} className="flex items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4
                                    onClick={() => onSelectBooking(b)}
                                    className="font-bold text-stone-900 text-xs hover:text-rose-700 cursor-pointer"
                                  >
                                    {b.title}
                                  </h4>
                                  {b.isPrebooking && (
                                    <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200">
                                      Pre-Booked
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-stone-600 mt-0.5">
                                  <span className="font-mono text-stone-500 font-medium">{formatTime12h(b.startTime)} - {formatTime12h(b.endTime)}</span> • <strong className="text-stone-800">{b.teacherName}</strong> • {b.className}
                                </p>
                              </div>

                              <button
                                onClick={() => onSelectBooking(b)}
                                className="text-xs font-semibold text-rose-700 hover:text-rose-900 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 transition-colors"
                              >
                                View
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-stone-400 text-xs py-1">
                          No booking starting at this hour
                        </div>
                      )}
                    </div>

                    {hourBookings.length === 0 && (
                      <div>
                        <button
                          onClick={() => onQuickBookSlot(dStr, hour)}
                          className="text-xs font-semibold text-stone-600 hover:text-rose-700 px-3 py-1.5 rounded-lg border border-stone-300 hover:border-rose-300 hover:bg-rose-50 transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Book
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
