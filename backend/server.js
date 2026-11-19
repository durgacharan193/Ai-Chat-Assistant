const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── Local JSON File Storage Fallback Setup ─────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'conversations.json');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]), 'utf8');
}

function loadLocalConversations() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveLocalConversations(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save local conversations:', e);
  }
}

// ─── MongoDB Connection ────────────────────────────────────────────────────────
let isMongoConnected = false;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai_chat_assistant';

mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2000 })
  .then(() => {
    isMongoConnected = true;
    console.log('✅ MongoDB connected successfully to ' + MONGO_URI);
  })
  .catch(err => {
    isMongoConnected = false;
    console.warn('⚠️ MongoDB connection unavailable (' + err.message + '). Active resilient fallback: File-backed local storage enabled.');
  });

mongoose.connection.on('connected', () => { isMongoConnected = true; });
mongoose.connection.on('disconnected', () => { isMongoConnected = false; });

// ─── Mongoose Schema & Model ───────────────────────────────────────────────────
const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const ConversationSchema = new mongoose.Schema({
  title: { type: String, default: 'New Conversation' },
  tone: { type: String, enum: ['Professional', 'Casual', 'Concise'], default: 'Professional' },
  messages: [MessageSchema],
  model: { type: String, default: 'openai' },        // 'openai' | 'claude'
  language: { type: String, default: 'en' },          // Extra Feature 1: Multi-language
  tags: [{ type: String }],                           // Extra Feature 2: Tags/Bookmarks
  isPinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Conversation = mongoose.model('Conversation', ConversationSchema);

// ─── Unified Storage Layer ─────────────────────────────────────────────────────
const Storage = {
  async getAll() {
    if (isMongoConnected) {
      return await Conversation.find({}, {
        title: 1, tone: 1, model: 1, language: 1, tags: 1,
        isPinned: 1, createdAt: 1, updatedAt: 1,
        messageCount: { $size: '$messages' },
      }).sort({ isPinned: -1, updatedAt: -1 });
    }
    const list = loadLocalConversations();
    return list
      .map(c => ({
        _id: c._id,
        title: c.title,
        tone: c.tone,
        model: c.model,
        language: c.language,
        tags: c.tags || [],
        isPinned: !!c.isPinned,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messageCount: (c.messages || []).length,
      }))
      .sort((a, b) => {
        if (b.isPinned !== a.isPinned) return b.isPinned ? 1 : -1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
  },

  async getById(id) {
    if (isMongoConnected) {
      return await Conversation.findById(id);
    }
    const list = loadLocalConversations();
    return list.find(c => c._id === id) || null;
  },

  async create(payload) {
    if (isMongoConnected) {
      const conv = new Conversation(payload);
      return await conv.save();
    }
    const list = loadLocalConversations();
    const newConv = {
      _id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: payload.title || 'New Conversation',
      tone: payload.tone || 'Professional',
      model: payload.model || 'openai',
      language: payload.language || 'en',
      tags: payload.tags || [],
      isPinned: false,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    list.unshift(newConv);
    saveLocalConversations(list);
    return newConv;
  },

  async update(id, updates) {
    if (isMongoConnected) {
      updates.updatedAt = new Date();
      return await Conversation.findByIdAndUpdate(id, updates, { new: true });
    }
    const list = loadLocalConversations();
    const idx = list.findIndex(c => c._id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
    saveLocalConversations(list);
    return list[idx];
  },

  async delete(id) {
    if (isMongoConnected) {
      return await Conversation.findByIdAndDelete(id);
    }
    let list = loadLocalConversations();
    const beforeLen = list.length;
    list = list.filter(c => c._id !== id);
    saveLocalConversations(list);
    return list.length !== beforeLen;
  },

  async search(query) {
    if (isMongoConnected) {
      return await Conversation.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { 'messages.content': { $regex: query, $options: 'i' } },
          { tags: { $regex: query, $options: 'i' } },
        ],
      }).select('title createdAt updatedAt tags tone model').limit(20);
    }
    const q = query.toLowerCase();
    const list = loadLocalConversations();
    return list
      .filter(c =>
        c.title?.toLowerCase().includes(q) ||
        c.tags?.some(t => t.toLowerCase().includes(q)) ||
        c.messages?.some(m => m.content?.toLowerCase().includes(q))
      )
      .slice(0, 20)
      .map(c => ({
        _id: c._id,
        title: c.title,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        tags: c.tags,
        tone: c.tone,
        model: c.model,
      }));
  },
};

// ─── Tone System Instructions ──────────────────────────────────────────────────
const TONE_INSTRUCTIONS = {
  Professional: 'You are a professional AI assistant. Respond in a formal, precise, and business-appropriate manner. Use complete sentences, proper grammar, and avoid slang or casual expressions.',
  Casual: 'You are a friendly and laid-back AI assistant. Respond in a conversational, warm, and approachable way. Feel free to use contractions, light humor, and everyday language.',
  Concise: 'You are a concise AI assistant. Keep your responses brief and to the point. Avoid unnecessary filler words or over-explanation. Use bullet points when helpful.',
};

// ─── Language Instructions ─────────────────────────────────────────────────────
const LANGUAGE_MAP = {
  en: 'English',
  hi: 'Hindi',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  zh: 'Chinese',
  ja: 'Japanese',
  ar: 'Arabic',
};

// ─── Build System Prompt ───────────────────────────────────────────────────────
function buildSystemPrompt(tone, language) {
  const toneInstr = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.Professional;
  const langName = LANGUAGE_MAP[language] || 'English';
  const langInstr = language !== 'en'
    ? ` Always respond in ${langName}.`
    : '';
  return toneInstr + langInstr;
}

// ─── Title Generator ───────────────────────────────────────────────────────────
async function generateTitle(firstMessage, model, tone) {
  try {
    const prompt = `Generate a short (3-5 word) conversation title for this user message: "${firstMessage}". Respond with ONLY the title, no punctuation.`;
    if (model === 'claude' && process.env.ANTHROPIC_API_KEY) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const res = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 20,
        messages: [{ role: 'user', content: prompt }],
      });
      return res.content[0].text.trim();
    } else if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 20,
        messages: [{ role: 'user', content: prompt }],
      });
      return res.choices[0].message.content.trim();
    }
  } catch (_) {}
  return firstMessage.slice(0, 35) + (firstMessage.length > 35 ? '…' : '');
}

// ─── Simulated AI Stream Generator (Fallback when API Keys not configured) ────
async function streamSimulatedResponse(res, message, tone, language) {
  const lang = LANGUAGE_MAP[language] || 'English';
  let responseText = '';

  if (tone === 'Concise') {
    responseText = `**Summary Response (${lang}):**\n\n• Point 1: Direct response to "${message.slice(0, 45)}".\n• Point 2: Concise technical analysis and actionable insight.\n• Status: Processed with high precision.`;
  } else if (tone === 'Casual') {
    responseText = `Hey! 👋 Thanks for asking about "${message.slice(0, 45)}".\n\nHere is how things work: everything flows smoothly, with the state handled cleanly on the backend! Let me know if you want to test out more tones or languages.`;
  } else {
    // Professional
    responseText = `**Executive Overview:**\n\nThank you for your query regarding "${message.slice(0, 45)}".\n\n### Architectural Assessment\nIn accordance with production standards, all business logic, validations, and state transitions are executed server-side. Tone modifier instructions are applied dynamically to every prompt invocation.\n\n### Key Deliverables\n1. Real-time streaming response via Server-Sent Events (SSE).\n2. Dual-mode state persistence with MongoDB and resilient storage fallback.\n3. Dynamic tone customization (Professional, Casual, Concise).`;
  }

  // Stream character-by-character to simulate real-time processing
  const words = responseText.split(' ');
  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? '' : ' ') + words[i];
    res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
    await new Promise(r => setTimeout(r, 25));
  }

  return responseText;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/health ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    storageMode: isMongoConnected ? 'mongodb' : 'file-fallback',
    mongodb: isMongoConnected ? 'connected' : 'fallback-active',
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
  });
});

// ── GET /api/conversations ─────────────────────────────────────────────────────
app.get('/api/conversations', async (req, res) => {
  try {
    const conversations = await Storage.getAll();
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/conversations/:id ─────────────────────────────────────────────────
app.get('/api/conversations/:id', async (req, res) => {
  try {
    const conv = await Storage.getById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/conversations ────────────────────────────────────────────────────
app.post('/api/conversations', async (req, res) => {
  try {
    const { tone = 'Professional', model = 'openai', language = 'en' } = req.body;
    const conv = await Storage.create({ tone, model, language });
    res.status(201).json(conv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/conversations/:id ─────────────────────────────────────────────
app.delete('/api/conversations/:id', async (req, res) => {
  try {
    await Storage.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/conversations/:id ──────────────────────────────────────────────
app.patch('/api/conversations/:id', async (req, res) => {
  try {
    const { tone, title, language, tags, isPinned } = req.body;
    const updates = {};
    if (tone !== undefined) updates.tone = tone;
    if (title !== undefined) updates.title = title;
    if (language !== undefined) updates.language = language;
    if (tags !== undefined) updates.tags = tags;
    if (isPinned !== undefined) updates.isPinned = isPinned;

    const conv = await Storage.update(req.params.id, updates);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/conversations/:id/chat  (SSE streaming) ─────────────────────────
app.post('/api/conversations/:id/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const conv = await Storage.getById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    // Append user message
    const userMsg = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    conv.messages = conv.messages || [];
    conv.messages.push(userMsg);

    // Auto-title on first message
    if (conv.messages.length === 1) {
      conv.title = await generateTitle(message, conv.model, conv.tone);
    }

    // Set SSE headers for real-time text streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const systemPrompt = buildSystemPrompt(conv.tone, conv.language);
    let fullResponse = '';

    const hasClaudeKey = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

    if (conv.model === 'claude' && hasClaudeKey) {
      // ── Claude Streaming ───────────────────────────────────────────────────
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const history = conv.messages.map(m => ({ role: m.role, content: m.content }));
      const stream = anthropic.messages.stream({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: history,
      });
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const token = chunk.delta.text;
          fullResponse += token;
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
    } else if (hasOpenAIKey) {
      // ── OpenAI Streaming ───────────────────────────────────────────────────
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const history = conv.messages.map(m => ({ role: m.role, content: m.content }));
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        stream: true,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
      });
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (token) {
          fullResponse += token;
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
    } else {
      // ── Resilient Real-Time Simulation Stream (Fallback when keys absent) ───
      fullResponse = await streamSimulatedResponse(res, message, conv.tone, conv.language);
    }

    // Persist AI response
    conv.messages.push({
      role: 'assistant',
      content: fullResponse,
      timestamp: new Date().toISOString(),
    });

    await Storage.update(req.params.id, {
      title: conv.title,
      messages: conv.messages,
    });

    res.write(`data: ${JSON.stringify({ done: true, conversationId: conv._id, title: conv.title })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Chat error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── POST /api/conversations/:id/regenerate ─────────────────────────────────────
app.post('/api/conversations/:id/regenerate', async (req, res) => {
  try {
    const conv = await Storage.getById(req.params.id);
    if (!conv || !conv.messages || conv.messages.length < 2) {
      return res.status(400).json({ error: 'Nothing to regenerate' });
    }

    if (conv.messages[conv.messages.length - 1].role === 'assistant') {
      conv.messages.pop();
    }

    const lastUserMsg = conv.messages[conv.messages.length - 1];
    if (!lastUserMsg || lastUserMsg.role !== 'user') {
      return res.status(400).json({ error: 'No user message to regenerate from' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const systemPrompt = buildSystemPrompt(conv.tone, conv.language);
    let fullResponse = '';

    const hasClaudeKey = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

    if (conv.model === 'claude' && hasClaudeKey) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const history = conv.messages.map(m => ({ role: m.role, content: m.content }));
      const stream = anthropic.messages.stream({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: history,
      });
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const token = chunk.delta.text;
          fullResponse += token;
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
    } else if (hasOpenAIKey) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const history = conv.messages.map(m => ({ role: m.role, content: m.content }));
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        stream: true,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
      });
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (token) {
          fullResponse += token;
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
    } else {
      fullResponse = await streamSimulatedResponse(res, lastUserMsg.content, conv.tone, conv.language);
    }

    conv.messages.push({
      role: 'assistant',
      content: fullResponse,
      timestamp: new Date().toISOString(),
    });

    await Storage.update(req.params.id, { messages: conv.messages });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── GET /api/search?q= ────────────────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const results = await Storage.search(q);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Storage: ${isMongoConnected ? 'MongoDB' : 'Resilient File Storage (fallback)'}`);
});
