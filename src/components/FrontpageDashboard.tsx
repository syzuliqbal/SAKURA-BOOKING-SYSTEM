import React, { useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  Users, 
  TrendingUp, 
  Award, 
  ArrowRight, 
  CheckCircle2, 
  BookmarkPlus,
  BookOpen
} from 'lucide-react';
import { Booking } from '../types';
import { SCHOOL_NAME, LAB_NAME, calculateDurationHours, formatTime12h } from '../data/timeSlots';

interface FrontpageDashboardProps {
  bookings: Booking[];
  onNavigateToCalendar: () => void;
  onOpenBookingModal: (isPrebooking?: boolean) => void;
  onSelectBooking: (booking: Booking) => void;
}

export const FrontpageDashboard: React.FC<FrontpageDashboardProps> = ({
  bookings,
  onNavigateToCalendar,
  onOpenBookingModal,
  onSelectBooking,
}) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Active bookings
  const activeBookings = useMemo(() => {
    return bookings.filter(b => b.status !== 'cancelled');
  }, [bookings]);

  // Today's Bookings
  const todayBookings = useMemo(() => {
    return activeBookings
      .filter(b => b.date === todayStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [activeBookings, todayStr]);

  // Monthly Bookings
  const monthlyBookings = useMemo(() => {
    return activeBookings.filter(b => {
      const bDate = new Date(b.date);
      return bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear;
    });
  }, [activeBookings, currentMonth, currentYear]);

  // Calculate actual total hours booked in current month
  const totalMonthlyHours = useMemo(() => {
    return monthlyBookings.reduce((sum, b) => {
      return sum + calculateDurationHours(b.startTime, b.endTime);
    }, 0);
  }, [monthlyBookings]);

  const monthlyPrebookingsCount = useMemo(() => {
    return monthlyBookings.filter(b => b.isPrebooking).length;
  }, [monthlyBookings]);

  // Teachers utilization
  const topTeachersThisMonth = useMemo(() => {
    const map = new Map<string, { count: number; hours: number }>();
    monthlyBookings.forEach(b => {
      const curr = map.get(b.teacherName) || { count: 0, hours: 0 };
      curr.count += 1;
      curr.hours += calculateDurationHours(b.startTime, b.endTime);
      map.set(b.teacherName, curr);
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 4);
  }, [monthlyBookings]);

  // Classes utilization
  const classBreakdownThisMonth = useMemo(() => {
    const map = new Map<string, number>();
    monthlyBookings.forEach(b => {
      map.set(b.className, (map.get(b.className) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([className, count]) => ({ className, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [monthlyBookings]);

  return (
    <div className="space-y-5 sm:space-y-6 max-w-5xl">
      {/* Top Welcome Banner in Soft Pastel Slate & Blush */}
      <div className="bg-stone-50 rounded-2xl p-4 sm:p-6 border border-stone-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                SAKURA
              </span>
              <span className="text-xs text-stone-500 font-medium">
                {now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-800 tracking-tight mt-1.5">
              {LAB_NAME}
            </h1>
            <p className="text-xs text-stone-600 mt-0.5">
              {SCHOOL_NAME}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onOpenBookingModal(true)}
              className="flex-1 sm:flex-none justify-center px-3.5 py-2 text-xs font-semibold rounded-xl bg-amber-100/80 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors flex items-center gap-1.5"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-amber-700" />
              <span>Pre-Book</span>
            </button>

            <button
              onClick={() => onOpenBookingModal(false)}
              className="flex-1 sm:flex-none justify-center px-4 py-2 text-xs font-semibold rounded-xl bg-rose-200/90 hover:bg-rose-200 text-rose-950 border border-rose-300 transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Book Lab</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: TODAY'S BOOKINGS (Clean pastel card) */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Daily Status</span>
            <h2 className="text-lg font-bold text-stone-800 mt-0.5 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rose-600" />
              <span>Bookings Today: <strong className="text-rose-700">{todayBookings.length}</strong> {todayBookings.length === 1 ? 'Session' : 'Sessions'}</span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Scheduled room reservations for {now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <button
            onClick={onNavigateToCalendar}
            className="text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 transition-colors self-start sm:self-center"
          >
            <span>Open Calendar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {todayBookings.length === 0 ? (
          <div className="py-8 text-center bg-stone-50/50 rounded-xl mt-4 border border-dashed border-stone-200">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto mb-2">
              <Clock className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-semibold text-stone-700">No Bookings Scheduled for Today</h4>
            <p className="text-[11px] text-stone-400 mt-0.5">The English Language Lab is currently open and free to book today.</p>
            <button
              onClick={() => onOpenBookingModal(false)}
              className="mt-3 px-3.5 py-1.5 text-xs font-semibold bg-rose-100 text-rose-900 border border-rose-200 rounded-lg hover:bg-rose-200 transition-colors"
            >
              Book an Available Slot Today
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {todayBookings.map((b) => (
              <div
                key={b.id}
                onClick={() => onSelectBooking(b)}
                className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/40 hover:bg-white hover:border-rose-300 hover:shadow-xs transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200/80 font-mono">
                    {formatTime12h(b.startTime)} – {formatTime12h(b.endTime)}
                  </span>
                  {b.isPrebooking ? (
                    <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                      <BookmarkPlus className="w-2.5 h-2.5 text-amber-700" /> Pre-Booked
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Confirmed
                    </span>
                  )}
                </div>

                <h3 className="text-xs font-bold text-stone-800 group-hover:text-rose-700 transition-colors line-clamp-1">
                  {b.title}
                </h3>

                <div className="flex items-center justify-between text-xs text-stone-600 mt-2">
                  <span className="font-medium text-stone-800">{b.teacherName}</span>
                  <span className="text-[11px] bg-white px-2 py-0.5 rounded border border-stone-200 text-stone-600">
                    {b.className}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: ROOM USAGE FOR THE MONTH (Pastel statistics) */}
      <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs">
        <div className="pb-4 border-b border-stone-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Monthly Usage</span>
          <h2 className="text-lg font-bold text-stone-800 mt-0.5 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            <span>Room Usage for the Month: <strong className="text-teal-800">{monthName}</strong></span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Total hours utilized and reservations logged for {LAB_NAME} this month
          </p>
        </div>

        {/* 3 Pastel Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5">
          <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-100">
            <span className="text-[11px] font-bold text-teal-800 block uppercase">Total Sessions Booked</span>
            <div className="text-2xl font-bold text-teal-950 mt-1">{monthlyBookings.length}</div>
          </div>

          <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100">
            <span className="text-[11px] font-bold text-rose-800 block uppercase">Total Lab Hours</span>
            <div className="text-2xl font-bold text-rose-950 mt-1">{totalMonthlyHours} hrs</div>
          </div>

          <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
            <span className="text-[11px] font-bold text-amber-800 block uppercase">Advance Pre-Bookings</span>
            <div className="text-2xl font-bold text-amber-950 mt-1">{monthlyPrebookingsCount}</div>
          </div>
        </div>

        {/* Breakdown by Faculty & Classes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5 pt-4 border-t border-stone-100">
          {/* Top Teachers */}
          <div>
            <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-600" />
              <span>Teacher's Lab Usage</span>
            </h4>
            <div className="space-y-2">
              {topTeachersThisMonth.length === 0 ? (
                <div className="text-xs text-stone-400 py-3">No bookings recorded yet this month.</div>
              ) : (
                topTeachersThisMonth.map((t, idx) => (
                  <div key={t.name} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-stone-50 border border-stone-100">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-700 font-bold text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-stone-800">{t.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-teal-800">{t.count} sessions</span>
                      <span className="text-[10px] text-stone-500 ml-1.5 font-mono">({t.hours} hrs)</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Classes Breakdown */}
          <div>
            <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Classes Utilizing Lab</span>
            </h4>
            <div className="space-y-2">
              {classBreakdownThisMonth.length === 0 ? (
                <div className="text-xs text-stone-400 py-3">No classes logged this month.</div>
              ) : (
                classBreakdownThisMonth.map((c) => (
                  <div key={c.className} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-stone-50 border border-stone-100">
                    <span className="font-semibold text-stone-700">{c.className}</span>
                    <span className="font-bold text-stone-800 bg-white px-2 py-0.5 rounded border border-stone-200">
                      {c.count} sessions
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between">
          <span className="text-xs text-stone-500">
            View upcoming schedule or pick any time to book
          </span>
          <button
            onClick={onNavigateToCalendar}
            className="px-4 py-2 text-xs font-semibold bg-teal-100 text-teal-900 hover:bg-teal-200 border border-teal-200 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Open Calendar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
