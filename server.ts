import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Persistent storage file
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'lab_data.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface StoredData {
  bookings: any[];
  logs: any[];
  telegramConfig: {
    botToken: string;
    chatId: string;
    threadId?: string;
    groupTitle?: string;
    enabled: boolean;
    notifyOnPrebooking: boolean;
    notifyOnInstantBooking: boolean;
    notifyOnApproval: boolean;
    notifyOnCancellation: boolean;
  };
}

const defaultData: StoredData = {
  bookings: [],
  logs: [],
  telegramConfig: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    threadId: '',
    groupTitle: 'English Dept Teachers',
    enabled: false,
    notifyOnPrebooking: true,
    notifyOnInstantBooking: true,
    notifyOnApproval: true,
    notifyOnCancellation: true,
  },
};

function readData(): StoredData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading lab data file:', err);
  }
  return defaultData;
}

function writeData(data: StoredData) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing lab data file:', err);
  }
}

// Ensure initial file exists
if (!fs.existsSync(DATA_FILE)) {
  writeData(defaultData);
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// GET all bookings
app.get('/api/bookings', (req, res) => {
  const data = readData();
  res.json(data.bookings || []);
});

// POST save all bookings or single
app.post('/api/bookings', (req, res) => {
  const data = readData();
  const newBooking = req.body;
  if (!newBooking.id) {
    newBooking.id = 'bkg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  }
  newBooking.createdAt = newBooking.createdAt || new Date().toISOString();
  newBooking.updatedAt = new Date().toISOString();

  // Prepend or add
  data.bookings = [newBooking, ...(data.bookings || []).filter(b => b.id !== newBooking.id)];
  writeData(data);
  res.status(201).json(newBooking);
});

// PUT update booking
app.put('/api/bookings/:id', (req, res) => {
  const data = readData();
  const { id } = req.params;
  const index = (data.bookings || []).findIndex(b => b.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  data.bookings[index] = {
    ...data.bookings[index],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  writeData(data);
  res.json(data.bookings[index]);
});

// DELETE booking
app.delete('/api/bookings/:id', (req, res) => {
  const data = readData();
  const { id } = req.params;
  data.bookings = (data.bookings || []).filter(b => b.id !== id);
  writeData(data);
  res.json({ success: true, id });
});

// GET logs
app.get('/api/logs', (req, res) => {
  const data = readData();
  res.json(data.logs || []);
});

// POST append log
app.post('/api/logs', (req, res) => {
  const data = readData();
  const newLog = req.body;
  if (!newLog.id) {
    newLog.id = 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  }
  newLog.timestamp = newLog.timestamp || new Date().toISOString();
  data.logs = [newLog, ...(data.logs || [])].slice(0, 500); // retain last 500 logs
  writeData(data);
  res.status(201).json(newLog);
});

// GET telegram configuration
app.get('/api/telegram/config', (req, res) => {
  const data = readData();
  // Hide actual token characters for safety in public view if needed, but return config
  res.json(data.telegramConfig || defaultData.telegramConfig);
});

// POST save telegram configuration
app.post('/api/telegram/config', (req, res) => {
  const data = readData();
  data.telegramConfig = {
    ...data.telegramConfig,
    ...req.body,
  };
  writeData(data);
  res.json(data.telegramConfig);
});

// POST send Telegram notification via Bot API
app.post('/api/telegram/notify', async (req, res) => {
  const { token, chatId, text, parseMode = 'HTML', threadId } = req.body;
  const data = readData();

  const botToken = token || data.telegramConfig?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const targetChatId = chatId || data.telegramConfig?.chatId || process.env.TELEGRAM_CHAT_ID;
  const targetThread = threadId || data.telegramConfig?.threadId;

  if (!botToken || !targetChatId) {
    return res.status(400).json({
      success: false,
      error: 'Telegram Bot Token and Chat ID are required.',
      simulated: true,
    });
  }

  try {
    const payload: Record<string, any> = {
      chat_id: targetChatId,
      text: text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    };
    if (targetThread) {
      payload.message_thread_id = targetThread;
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      return res.status(response.status || 400).json({
        success: false,
        error: result.description || 'Failed to send message to Telegram',
        details: result,
      });
    }

    res.json({
      success: true,
      messageId: result.result?.message_id,
      chat: result.result?.chat?.title || targetChatId,
    });
  } catch (error: any) {
    console.error('Telegram dispatch error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Network error reaching Telegram API',
    });
  }
});

// POST test Telegram connection
app.post('/api/telegram/test', async (req, res) => {
  const { token, chatId } = req.body;
  const botToken = token || process.env.TELEGRAM_BOT_TOKEN;
  const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;

  if (!botToken) {
    return res.status(400).json({ success: false, error: 'Bot token is missing' });
  }

  try {
    // Check bot identity first
    const getMeRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botInfo = await getMeRes.json();

    if (!botInfo.ok) {
      return res.status(400).json({
        success: false,
        error: `Invalid Bot Token: ${botInfo.description}`,
      });
    }

    if (targetChatId) {
      const testMsg = `🔔 <b>English Language Lab System Test</b>\n\n✅ Bot connection verified successfully!\n📅 Timestamp: ${new Date().toLocaleString()}\n🏫 Location: Language Lab Room 102\n\nNotifications for new bookings and pre-bookings will be posted here.`;
      const sendRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: testMsg,
          parse_mode: 'HTML',
        }),
      });
      const sendInfo = await sendRes.json();
      if (!sendInfo.ok) {
        return res.status(400).json({
          success: false,
          botUser: botInfo.result?.username,
          error: `Bot is valid (@${botInfo.result?.username}), but message to Chat ID failed: ${sendInfo.description}. Make sure the bot is added to the group as member/admin!`,
        });
      }
      return res.json({
        success: true,
        botUsername: botInfo.result?.username,
        chatTitle: sendInfo.result?.chat?.title || targetChatId,
        message: 'Test alert sent successfully to Telegram group!',
      });
    }

    return res.json({
      success: true,
      botUsername: botInfo.result?.username,
      message: `Bot @${botInfo.result?.username} is valid! Please provide a Group Chat ID to test sending.`,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to reach Telegram servers',
    });
  }
});

// Setup Vite middleware in dev or serve dist in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();
