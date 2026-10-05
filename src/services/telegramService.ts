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

/**
 * Extracts integer Thread/Topic ID from string, number, or Telegram URL.
 * Handles cases like:
 * - 42
 * - "#42"
 * - "Topic 42"
 * - "https://t.me/c/2147483648/42"
 * - "https://t.me/c/2147483648/42/105"
 */
export function parseTelegramThreadId(raw: string | number | undefined | null): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;

  // If user pasted a Telegram URL
  const linkMatch = s.match(/t\.me\/c\/(\d+)\/(\d+)/i);
  if (linkMatch) {
    return parseInt(linkMatch[2], 10);
  }

  // Remove leading '#' or 'topic' or 'thread'
  const cleaned = s.replace(/^[#\s]*(?:topic|thread)?\s*/i, '').trim();
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? undefined : num;
}

/**
 * Parses full Telegram topic link to extract both Chat ID and Topic ID:
 * e.g. "https://t.me/c/2147483648/42" -> { chatId: "-1002147483648", threadId: "42" }
 */
export function extractTelegramLinkDetails(raw: string): { chatId?: string; threadId?: string } | null {
  if (!raw) return null;
  const match = raw.match(/t\.me\/c\/(\d+)\/(\d+)/i);
  if (match) {
    const rawChat = match[1];
    const thread = match[2];
    const fullChatId = rawChat.startsWith('-100') ? rawChat : `-100${rawChat}`;
    return {
      chatId: fullChatId,
      threadId: thread,
    };
  }
  return null;
}

export function formatTelegramBookingMessage(
  booking: Booking,
  eventType: 'new_booking' | 'prebooking' | 'cancellation'
): string {
  const timeFormatted = `${formatTime12h(booking.startTime)} - ${formatTime12h(booking.endTime)}`;

  if (eventType === 'cancellation') {
    return `❌ <b>ENGLISH LAB BOOKING CANCELLED</b>
━━━━━━━━━━━━━━━
🏫 <b>SAKURA Lab Booking System</b>
📍 <b>English Language Lab</b>

📅 <b>Date:</b> ${booking.date}
⏰ <b>Time:</b> ${timeFormatted}
👤 <b>Teacher:</b> ${booking.teacherName}
🎓 <b>Class:</b> ${booking.className}
🎯 <b>Purpose:</b> ${booking.title}
${booking.notes ? `\n💬 <b>Remarks:</b> ${booking.notes}\n` : ''}

<i>Slot is now available on the calendar for other teachers to book.</i>`;
  }

  const isPrebooking = booking.isPrebooking;
  const isRecurring = booking.isRecurring && booking.recurringUntil;

  let headerTitle = 'NEW ENGLISH LAB BOOKING';
  if (isRecurring) {
    headerTitle = 'NEW RECURRING PRE-BOOKING';
  } else if (isPrebooking) {
    headerTitle = 'NEW ADVANCE PRE-BOOKING';
  }

  return `🔔 <b>${headerTitle}</b>
━━━━━━━━━━━━━━━
🏫 <b>SAKURA Lab Booking System</b>
📍 <b>English Language Lab</b>

📅 <b>Date:</b> ${booking.date}${isRecurring ? ` <i>(Weekly until ${booking.recurringUntil})</i>` : ''}
⏰ <b>Time:</b> ${timeFormatted}
👤 <b>Teacher:</b> ${booking.teacherName}
🎓 <b>Class:</b> ${booking.className}
🎯 <b>Purpose:</b> ${booking.title}
${isRecurring ? `🔁 <b>Frequency:</b> Every week until ${booking.recurringUntil}\n` : ''}${isPrebooking && booking.prebookingReason ? `📋 <b>Pre-booking Note:</b> ${booking.prebookingReason}\n` : ''}${booking.notes ? `💬 <b>Remarks:</b> ${booking.notes}\n` : ''}

✅ Confirmed & logged on the calendar.`;
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
    const parsedId = parseTelegramThreadId(config.threadId);
    if (parsedId !== undefined) {
      payload.message_thread_id = parsedId;
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
  chatId: string,
  threadId?: string
): Promise<{ success: boolean; message: string; botUsername?: string }> {
  try {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, chatId, threadId }),
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
      const parsedTopic = parseTelegramThreadId(threadId);
      const isTopicTarget = parsedTopic !== undefined;
      const testMsg = isTopicTarget
        ? `🔔 <b>${SCHOOL_NAME}</b>\n📍 <b>${LAB_NAME}</b>\n\n✅ Bot connection verified successfully for Topic #${parsedTopic}!\n📅 Timestamp: ${new Date().toLocaleString()}\n\nEnglish Lab notifications will be posted strictly in this topic.`
        : `🔔 <b>${SCHOOL_NAME}</b>\n📍 <b>${LAB_NAME}</b>\n\n✅ Bot connection verified successfully!\n📅 Timestamp: ${new Date().toLocaleString()}\n\nEnglish Lab notifications will be posted to this group.`;

      const payload: Record<string, any> = {
        chat_id: chatId,
        text: testMsg,
        parse_mode: 'HTML',
      };
      if (isTopicTarget) {
        payload.message_thread_id = parsedTopic;
      }

      const msgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const msgData = await msgRes.json();
      if (!msgData.ok) {
        return {
          success: false,
          botUsername: username,
          message: `Bot @${username} is valid, but message to Chat ID ${chatId} failed: ${msgData.description}. ${isTopicTarget ? 'Ensure the Topic ID is valid and the bot has permission to post in this topic.' : 'Ensure the bot is added to your Telegram group!'}`,
        };
      }
      return {
        success: true,
        botUsername: username,
        message: isTopicTarget
          ? `Successfully sent test message directly to Topic #${threadId} in "${msgData.result?.chat?.title || chatId}"!`
          : `Successfully connected to Telegram group "${msgData.result?.chat?.title || chatId}"!`,
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
