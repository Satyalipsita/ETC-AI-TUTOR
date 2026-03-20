/**
 * ECE Tutor — Express Backend Server
 * ------------------------------------
 * Handles:
 *   POST /api/chat          — text + optional base64 image → Claude reply
 *   POST /api/chat-voice    — same as /api/chat (voice transcript sent as text)
 *   GET  /api/health        — health check
 *
 * Run:
 *   npm install
 *   ANTHROPIC_API_KEY=sk-ant-... node server.js
 *
 * Or create a .env file with ANTHROPIC_API_KEY=sk-ant-...
 */

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const multer    = require('multer');
const path      = require('path');
const fs        = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '20mb' }));       // large enough for base64 images
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));  // serves index.html

// Multer — in-memory storage (images arrive as base64 from browser anyway)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }       // 10 MB cap
});

// ── Anthropic config ──────────────────────────────────────────────────────────
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL             = 'claude-sonnet-4-20250514';
const MAX_TOKENS        = 1024;

const SYSTEM_PROMPT = `You are an expert ECE (Electronics and Telecommunication Engineering) tutor. You help students understand concepts clearly with examples, analogies, and mathematical explanations.

Your expertise covers:
- Analog & Digital Electronics
- Signals & Systems
- Communication Systems (AM, FM, OFDM, PCM, etc.)
- Electromagnetic Fields & Maxwell's equations
- Microwave Engineering & waveguides
- VLSI Design & CMOS
- Control Systems (PID, Bode, Root Locus)
- Antenna & Wave Propagation
- Network Theory
- Embedded Systems & RTOS
- DSP (FFT, FIR, IIR filters)

Guidelines:
- Keep answers clear and educational.
- Use **bold** for key terms, \`code\` for formulas/values.
- For circuits or diagrams, describe them textually and step-by-step.
- Be encouraging. Adapt to the student's apparent level.
- If an image is provided, analyse it in the ECE context (circuit diagram, waveform, block diagram, etc.).
- For simple questions: 3–5 sentences. For complex ones: structured, detailed.`;

// ── Helper: call Claude API ───────────────────────────────────────────────────
async function callClaude(messages, topic) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set in environment.');

  const systemWithTopic = topic
    ? `${SYSTEM_PROMPT}\n\nCurrently focused topic: **${topic}**`
    : SYSTEM_PROMPT;

  const response = await fetch(ANTHROPIC_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     systemWithTopic,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? 'No response generated.';
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', model: MODEL, timestamp: new Date().toISOString() });
});

/**
 * POST /api/chat
 * Body (JSON):
 * {
 *   messages: [{ role, content }],   // full conversation history
 *   topic:    "Analog Electronics",  // optional current topic
 *   image:    "data:image/png;base64,...",  // optional base64 image string
 * }
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [], topic = '', image = null } = req.body;

    if (!messages.length) {
      return res.status(400).json({ error: 'messages array is required.' });
    }

    // Build Claude messages array
    let claudeMessages = messages.slice(0, -1).map(m => ({
      role:    m.role,
      content: m.content,
    }));

    // Last user message — may include an image
    const lastMsg = messages[messages.length - 1];
    let lastContent;

    if (image && lastMsg.role === 'user') {
      // Parse base64 data URI  →  { mediaType, data }
      const match = image.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ error: 'Invalid image format. Send a base64 data URI.' });
      }
      const [, mediaType, b64data] = match;

      lastContent = [
        {
          type:   'image',
          source: { type: 'base64', media_type: mediaType, data: b64data },
        },
        {
          type: 'text',
          text: lastMsg.content || 'Please analyse this image in the context of ECE.',
        },
      ];
    } else {
      lastContent = lastMsg.content;
    }

    claudeMessages.push({ role: lastMsg.role, content: lastContent });

    const reply = await callClaude(claudeMessages, topic);
    res.json({ reply });

  } catch (err) {
    console.error('[/api/chat]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/chat-voice
 * Same contract as /api/chat.
 * Voice transcript is already converted to text by the browser (Web Speech API)
 * and sent as a normal text message.  This endpoint exists as a named alias
 * so the frontend can differentiate analytics / logging if needed.
 */
app.post('/api/chat-voice', async (req, res) => {
  // Delegate to the same logic
  req.url = '/api/chat';
  app._router.handle(req, res, () => {});
});

// Fallback: serve index.html for any unknown GET (SPA style)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 ECE Tutor server running at http://localhost:${PORT}`);
  console.log(`   Model  : ${MODEL}`);
  console.log(`   API key: ${process.env.ANTHROPIC_API_KEY ? '✅ set' : '❌ MISSING — set ANTHROPIC_API_KEY'}\n`);
});
