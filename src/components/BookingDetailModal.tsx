import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Users, 
  Send, 
  Trash2, 
  BookmarkPlus, 
  Check,
  Building
} from 'lucide-react';
import { Booking, TelegramConfig } from '../types';
import { SCHOOL_NAME, LAB_NAME, formatTime12h, calculateDurationHours } from '../data/timeSlots';

interface BookingDetailModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onCancelBooking: (bookingId: string) => Promise<void>;
  onResendTelegram: (booking: Booking) => Promise<void>;
  telegramConfig: TelegramConfig;
}

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  booking,
  isOpen,
  onClose,
  onCancelBooking,
  onResendTelegram,
  telegramConfig,
}) => {
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [telegramSuccessMessage, setTelegramSuccessMessage] = useState('');
  const [telegramErrorMessage, setTelegramErrorMessage] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (!isOpen || !booking) return null;

  const durationHours = calculateDurationHours(booking.startTime, booking.endTime);

  const handleExecuteCancel = async () => {
    setIsCancelling(true);
    try {
      await onCancelBooking(booking.id);
      onClose();
    } finally {
      setIsCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  const handleResend = async () => {
    setIsSendingTelegram(true);
    setTelegramErrorMessage('');
    try {
      await onResendTelegram(booking);
      setTelegramSuccessMessage('Telegram alert dispatched!');
      setTimeout(() => setTelegramSuccessMessage(''), 4000);
    } catch (e: any) {
      setTelegramErrorMessage('Failed to send Telegram alert: ' + (e.message || 'Network error'));
      setTimeout(() => setTelegramErrorMessage(''), 5000);
    } finally {
      setIsSendingTelegram(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-2xs overflow-y-auto font-sans">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 my-8 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              booking.isPrebooking ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'
            }`}>
              {booking.isPrebooking ? <BookmarkPlus className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
            </div>
            <div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                booking.isPrebooking ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-teal-100 text-teal-900 border border-teal-200'
              }`}>
                {booking.isPrebooking ? 'Advance Pre-Booking' : 'Confirmed Booking'}
              </span>
              <h3 className="text-base font-bold text-stone-900 mt-1">
                {booking.title}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body in Pastel */}
        <div className="py-4 space-y-3.5 text-xs text-stone-700">
          {telegramSuccessMessage && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{telegramSuccessMessage}</span>
            </div>
          )}

          {/* Time & Venue */}
          <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200">
            <div>
              <span className="text-stone-500 block text-[11px]">Date &amp; Time</span>
              <div className="font-bold text-stone-900 mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-rose-600" />
                <span>{booking.date}</span>
              </div>
              <div className="text-stone-700 font-mono mt-0.5 font-medium">
                {formatTime12h(booking.startTime)} - {formatTime12h(booking.endTime)} ({durationHours}h)
              </div>
            </div>

            <div>
              <span className="text-stone-500 block text-[11px]">System</span>
              <div className="font-bold text-stone-900 mt-0.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-teal-600" />
                <span>{LAB_NAME}</span>
              </div>
              <div className="text-stone-500 text-[11px] mt-0.5">
                {SCHOOL_NAME}
              </div>
            </div>
          </div>

          {/* Teacher & Class */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-stone-200">
              <span className="text-stone-500 block text-[11px]">Teacher</span>
              <div className="font-bold text-stone-900 mt-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-stone-500" />
                <span>{booking.teacherName}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-stone-200">
              <span className="text-stone-500 block text-[11px]">Class</span>
              <div className="font-bold text-stone-900 mt-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-stone-500" />
                <span>{booking.className}</span>
              </div>
            </div>
          </div>

          {/* Pre-booking Remarks if any */}
          {booking.isPrebooking && booking.prebookingReason && (
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900">
              <span className="font-bold block mb-0.5">Pre-Booking Notes:</span>
              <p>{booking.prebookingReason}</p>
            </div>
          )}

          {/* Remarks */}
          {booking.notes && (
            <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
              <span className="font-semibold text-stone-800 block mb-0.5">Remarks:</span>
              <p className="text-stone-600 italic">{booking.notes}</p>
            </div>
          )}

          {/* Telegram Status */}
          <div className="p-3 rounded-xl bg-sky-50/80 border border-sky-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-sky-600" />
              <div>
                <span className="font-bold text-sky-950 block">Telegram Notification</span>
                <span className="text-[11px] text-sky-700">
                  {booking.telegramNotified ? 'Dispatched to group' : 'Not yet dispatched'}
                </span>
              </div>
            </div>

            <button
              onClick={handleResend}
              disabled={isSendingTelegram}
              className="px-2.5 py-1 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors"
            >
              {isSendingTelegram ? 'Sending...' : 'Resend Alert'}
            </button>
          </div>

          {telegramErrorMessage && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {telegramErrorMessage}
            </div>
          )}

          {telegramSuccessMessage && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
              {telegramSuccessMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        {showCancelConfirm ? (
          <div className="pt-3 border-t border-rose-200 bg-rose-50/50 -mx-6 -mb-6 p-4 rounded-b-2xl space-y-2">
            <p className="text-xs text-rose-950 font-semibold">
              Cancel this booking and free the slot on the calendar?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="text-xs font-semibold text-stone-600 bg-white border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-50"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleExecuteCancel}
                disabled={isCancelling}
                className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 px-3.5 py-1.5 rounded-lg shadow-2xs"
              >
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel Booking'}
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="text-xs font-semibold text-rose-700 hover:text-rose-900 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Cancel Booking</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
