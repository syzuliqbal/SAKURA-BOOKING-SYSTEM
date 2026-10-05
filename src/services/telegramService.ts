import { Booking, TelegramConfig } from '../types';
import { SCHOOL_NAME, LAB_NAME, formatTime12h } from '../data/timeSlots';

export interface TelegramSendResult {
  success: boolean;
  messageId?: number;
  chatTitle?: string;
  simulated?: boolean;
  error?: string;
  previewText?: string;
}

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  botToken: '',
  chatId: '',
  threadId: '',
  groupTitle: 'SAKURA Teachers Group',
  enabled: true,
};

export function formatTelegramBookingMessage(
  booking: Booking,
  eventType: 'new_booking' | 'prebooking' | 'cancellation'
): string {
  const timeFormatted = `${formatTime12h(booking.startTime)} - ${formatTime12h(booking.endTime)}`;

  if (eventType === 'cancellation') {
    return `❌ <b>ENGLISH LAB BOOKING CANCELLED</b>
━━━━━━━━━━━━━━━━━━
🏫 <b>${SCHOOL_NAME}</b>
📍 <b>${LAB_NAME}</b>

📅 <b>Date:</b> ${booking.date}
⏰ <b>Time:</b> ${timeFormatted}
👤 <b>Teacher:</b> ${booking.teacherName}
🎓 <b>Class:</b> ${booking.className}
🎯 <b>Lesson:</b> ${booking.title}

<i>This slot is now available on the calendar for other teachers to book.</i>`;
  }

  const isPrebooking = booking.isPrebooking;
  const isRecurring = booking.isRecurring && booking.recurringUntil;

  return `🔔 <b>${isRecurring ? 'NEW RECURRING PRE-BOOKING' : isPrebooking ? 'NEW ADVANCE PRE-BOOKING' : 'NEW ENGLISH LAB BOOKING'}</b>
━━━━━━━━━━━━━━━━━━
🏫 <b>${SCHOOL_NAME}</b>
📍 <b>${LAB_NAME}</b>

📅 <b>Date:</b> ${booking.date}${isRecurring ? ` <i>(Repeats weekly until ${booking.recurringUntil})</i>` : ''}
⏰ <b>Time:</b> ${timeFormatted}
👤 <b>Teacher:</b> ${booking.teacherName}
🎓 <b>Class:</b> ${booking.className}
🎯 <b>Purpose:</b> ${booking.title}
${isRecurring ? `🔁 <b>Frequency:</b> Every week until ${booking.recurringUntil}\n` : ''}${isPrebooking && booking.prebookingReason ? `📋 <b>Pre-booking Info:</b> ${booking.prebookingReason}\n` : ''}
${booking.notes ? `💬 <b>Teacher Remarks:</b> <i>${booking.notes}</i>\n` : ''}
✅ <i>Confirmed & logged on the school calendar.</i>`;
}

export async function sendTelegramNotification(
  config: TelegramConfig,
  text: string
): Promise<TelegramSendResult> {
  if (!config.botToken || !config.chatId) {
    return {
      success: true,
      simulated: true,
      chatTitle: config.groupTitle || 'Telegram Group (Simulated)',
      previewText: text,
    };
  }

  try {
    const serverRes = await fetch('/api/telegram/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: config.botToken,
        chatId: config.chatId,
        threadId: config.threadId,
        text: text,
        parseMode: 'HTML',
      }),
    });

    if (serverRes.ok) {
      const data = await serverRes.json();
      return {
        success: true,
        messageId: data.messageId,
        chatTitle: data.chat || config.groupTitle,
        simulated: false,
      };
    }
  } catch (e) {}

  try {
    const payload: Record<string, any> = {
      chat_id: config.chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (config.threadId) {
      payload.message_thread_id = config.threadId;
    }

    const directRes = await fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const result = await directRes.json();
    if (result.ok) {
      return {
        success: true,
        messageId: result.result?.message_id,
        chatTitle: result.result?.chat?.title || config.chatId,
        simulated: false,
      };
    } else {
      return {
        success: false,
        error: result.description || 'Telegram API returned an error',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error reaching Telegram',
    };
  }
}

export async function testTelegramConnection(
  token: string,
  chatId: string
): Promise<{ success: boolean; message: string; botUsername?: string }> {
  try {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, chatId }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {}

  try {
    const botCheck = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const botData = await botCheck.json();
    if (!botData.ok) {
      return { success: false, message: `Invalid Bot Token: ${botData.description}` };
    }
    const username = botData.result?.username;

    if (chatId) {
      const msgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🔔 <b>${SCHOOL_NAME}</b>\n📍 <b>${LAB_NAME}</b>\n\n✅ Bot connection verified successfully!\n📅 Timestamp: ${new Date().toLocaleString()}\n\nEnglish Lab notifications will be posted to this group.`,
          parse_mode: 'HTML',
        }),
      });
      const msgData = await msgRes.json();
      if (!msgData.ok) {
        return {
          success: false,
          botUsername: username,
          message: `Bot @${username} is valid, but message to Chat ID ${chatId} failed: ${msgData.description}. Ensure the bot is added to your Telegram group!`,
        };
      }
      return {
        success: true,
        botUsername: username,
        message: `Successfully connected to Telegram group "${msgData.result?.chat?.title || chatId}"!`,
      };
    }

    return {
      success: true,
      botUsername: username,
      message: `Bot @${username} is valid! Enter your group Chat ID to test sending.`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to reach Telegram servers' };
  }
}
