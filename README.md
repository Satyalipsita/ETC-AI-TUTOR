# ⚡ ECE Tutor — AI Backend

A full-stack Node.js/Express backend for the ECE Tutor app, powered by Claude (Anthropic).

## Features
| Feature | How it works |
|---|---|
| Text Q&A | POST `/api/chat` → Claude answers ECE questions |
| Image analysis | Attach circuit/diagram image → Claude explains it |
| Voice input | Browser Web Speech API → transcript sent as text |
| Voice output | Browser SpeechSynthesis API reads Claude's reply aloud |
| Topic context | Active subject sent with every request for focused answers |

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set your API key
```bash
cp .env.example .env
# Edit .env and paste your Anthropic API key
```

### 3. Run the server
```bash
npm start
# → http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev   # requires: npm install -g nodemon
```

---

## API Reference

### `GET /api/health`
Returns server status.
```json
{ "status": "ok", "model": "claude-sonnet-4-20250514", "timestamp": "..." }
```

---

### `POST /api/chat`
Main chat endpoint. Handles text + optional image.

**Request body (JSON):**
```json
{
  "messages": [
    { "role": "user",      "content": "Explain BJT biasing" },
    { "role": "assistant", "content": "BJT biasing sets the DC operating point..." },
    { "role": "user",      "content": "What about collector current?" }
  ],
  "topic": "Analog Electronics",
  "image": "data:image/png;base64,iVBORw0KGgoAAAANS..."
}
```

- `messages` — full conversation history (required)
- `topic` — current subject shown in sidebar (optional, improves focus)
- `image` — base64 data URI of an image (optional, for circuit/diagram analysis)

**Response:**
```json
{ "reply": "The collector current Ic = β × Ib..." }
```

---

### `POST /api/chat-voice`
Identical to `/api/chat`. Named separately so you can distinguish voice vs text in logs.
Voice transcript arrives as normal `content` text from the browser's Web Speech API.

---

## Project Structure
```
etec-tutor/
├── server.js          ← Express server (API key lives here, never in browser)
├── package.json
├── .env.example       ← Copy to .env and add your key
└── public/
    └── index.html     ← Full frontend (your design + backend wired in)
```

## Environment Variables
| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (required) |
| `PORT` | Server port (default: 3000) |

## Security Notes
- The Anthropic API key lives **only on the server** — never sent to the browser.
- Image uploads are processed in memory (no disk writes).
- CORS is open for development; restrict in production with `cors({ origin: 'yourdomain.com' })`.
