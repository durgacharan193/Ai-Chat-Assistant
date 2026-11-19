# AI Chat Assistant
### Vibe Coding Challenge | Quantiphi × KITS Warangal

A full-stack AI Chat Assistant built with **React**, **Node.js/Express**, and **MongoDB**, featuring real-time streaming, persistent conversation history, tone customization, multilingual support, and smart tagging.

---

## 📋 Requirements Fulfilled

### From the PDF — Problem Statement

| Requirement | Status | Implementation |
|---|---|---|
| **Chat Interface** | ✅ | Scrollable conversation view with distinct bubbles for User (indigo) and AI (dark card) |
| **Streaming View** | ✅ | Token-by-token SSE streaming with animated cursor + typing dots |
| **History Sidebar** | ✅ | Grouped by Today / Yesterday / Past 7 Days / Older with search |
| **API Integration** | ✅ | Supports both **OpenAI GPT-4o Mini** and **Claude 3.5 Sonnet** |
| **Persistence (MongoDB)** | ✅ | Stores conversation object with timestamp, user prompt, AI response |
| **Tone Toggle (Vibe Check)** | ✅ | Professional / Casual / Concise — passed as system instruction to AI API |

### Extra Features Added

| Feature | Description |
|---|---|
| **🌐 Multilingual Responses** | 8 languages (English, Hindi, Spanish, French, German, Chinese, Japanese, Arabic) — language instruction passed to AI |
| **🏷️ Smart Tagging & Bookmarking** | Tag conversations with custom labels; filter by tag in sidebar search |
| **📌 Pin Conversations** | Pin important chats to the top of the sidebar |
| **🔄 Regenerate Response** | Re-run last AI response with the same context (new streaming call) |
| **🔍 Global Search** | Search conversations by title, content, and tags via MongoDB regex |
| **🤖 Auto-title Generation** | First message automatically generates a 3-5 word conversation title |
| **🎨 Markdown Rendering** | Full GFM markdown with syntax-highlighted code blocks (Prism) |
| **⚙️ Model Switcher** | Switch between OpenAI GPT-4o Mini and Claude 3.5 Sonnet per conversation |
| **📋 Copy Message** | One-click copy any message to clipboard |
| **🛑 Stop Generation** | Cancel an in-progress stream immediately |

---

## 🗂️ Project Structure

```
ai-chat-assistant/
├── backend/
│   ├── server.js          # Express + MongoDB + SSE streaming
│   ├── package.json
│   └── .env.example       # Environment variables template
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js                          # Router + conversation state
│   │   ├── index.js                        # React entry point
│   │   ├── styles/
│   │   │   └── globals.css                 # Complete design system
│   │   ├── hooks/
│   │   │   └── useApi.js                   # API calls + SSE stream helpers
│   │   └── components/
│   │       ├── Sidebar.js                  # History sidebar with search/groups
│   │       ├── ChatWindow.js               # Chat UI + streaming + controls
│   │       └── WelcomeScreen.js            # Landing / quick-start cards
│   └── package.json
├── README.md
└── docker-compose.yml     # Optional: MongoDB via Docker
```

---

## 🚀 Setup & Running

### Prerequisites
- Node.js ≥ 18
- MongoDB (local or cloud: [MongoDB Atlas](https://www.mongodb.com/atlas))
- An OpenAI API key **and/or** Anthropic API key

### 1. Clone / Navigate to Project
```bash
cd ai-chat-assistant
```

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env — add your OPENAI_API_KEY and/or ANTHROPIC_API_KEY
npm install
npm run dev        # or: npm start
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm start          # Starts on http://localhost:3000
```

### 4. MongoDB (Optional: via Docker)
```bash
docker-compose up -d
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check (MongoDB status, API key presence) |
| `GET` | `/api/conversations` | List all conversations (sorted by pin, then date) |
| `POST` | `/api/conversations` | Create new conversation |
| `GET` | `/api/conversations/:id` | Get single conversation with messages |
| `PATCH` | `/api/conversations/:id` | Update tone / language / tags / pin / title |
| `DELETE` | `/api/conversations/:id` | Delete conversation |
| `POST` | `/api/conversations/:id/chat` | **SSE** — Send message, stream AI response |
| `POST` | `/api/conversations/:id/regenerate` | **SSE** — Re-generate last AI response |
| `GET` | `/api/search?q=…` | Search conversations by title / content / tags |

---

## 📡 Streaming (SSE) Protocol

The `/chat` and `/regenerate` endpoints return `text/event-stream`. Each event is:

```
data: {"token": "Hello"}
data: {"token": " world"}
data: {"done": true, "conversationId": "...", "title": "My first chat"}
```

On error:
```
data: {"error": "OpenAI API key not configured"}
```

---

## 🎨 Tone System

| Tone | System Instruction Modifier |
|---|---|
| **Professional** | Formal, precise, business-appropriate language |
| **Casual** | Conversational, warm, contractions, light humor |
| **Concise** | Brief, to-the-point, bullet points when useful |

The tone is stored per-conversation in MongoDB and passed as the **system instruction** to every API request.

---

## 🌍 Multilingual Support (Extra Feature 1)

Appends `"Always respond in [Language]."` to the system instruction when a non-English language is selected. Supported: English, Hindi, Spanish, French, German, Chinese, Japanese, Arabic.

## 🏷️ Smart Tagging (Extra Feature 2)

- Add custom text tags to any conversation (e.g., `work`, `personal`, `research`)
- Tags are stored in MongoDB as an array on the conversation document
- Sidebar search matches against tags
- Global `/api/search` endpoint also searches tags

---

## 🗄️ MongoDB Schema

```js
Conversation {
  title:     String,         // Auto-generated from first message
  tone:      'Professional' | 'Casual' | 'Concise',
  model:     'openai' | 'claude',
  language:  String,         // 'en', 'hi', 'es', …
  tags:      [String],       // Smart tagging (Extra Feature 2)
  isPinned:  Boolean,
  messages:  [{
    role:      'user' | 'assistant',
    content:   String,
    timestamp: Date,
  }],
  createdAt: Date,
  updatedAt: Date,
}
```

---

## 🖥️ Expected Output Screenshots

### Welcome Screen
- Central ✦ logo, gradient title "AI Chat Assistant"
- 4 quick-start cards (Explain, Write, Solve, Translate)
- Feature list at the bottom

### Chat Interface
- **Left sidebar**: Search bar, model/tone selectors for new chat, New Chat button, grouped conversation list with pin/delete actions
- **Top bar**: Conversation title + Tone Toggle buttons (Professional / Casual / Concise) + Language selector + Tag button + Model badge
- **Messages**: User bubbles (indigo, right-aligned) + AI bubbles (dark card, left-aligned) with avatars, markdown rendering, copy button
- **Streaming**: Token-by-token text with blinking cursor
- **Input row**: Auto-growing textarea + Send / Stop button

---

## 🧪 Testing the API (curl examples)

```bash
# Health check
curl http://localhost:5000/api/health

# Create conversation
curl -X POST http://localhost:5000/api/conversations \
  -H "Content-Type: application/json" \
  -d '{"tone":"Professional","model":"openai","language":"en"}'

# Send a message (SSE — view stream)
curl -N -X POST http://localhost:5000/api/conversations/<ID>/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Explain machine learning in simple terms."}'

# Change tone to Casual
curl -X PATCH http://localhost:5000/api/conversations/<ID> \
  -H "Content-Type: application/json" \
  -d '{"tone":"Casual"}'

# Add tags
curl -X PATCH http://localhost:5000/api/conversations/<ID> \
  -H "Content-Type: application/json" \
  -d '{"tags":["ai","learning"]}'

# Search
curl "http://localhost:5000/api/search?q=machine+learning"
```
