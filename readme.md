# ProShop v2 — AI Agent Edition

> A full-stack e-commerce platform with an AI-powered shopping assistant, built on top of [Brad Traversy's ProShop v2](https://github.com/bradtraversy/proshop-v2).
>
> **Live Demo:** [proshop.anandbhagat.com](https://proshop.anandbhagat.com/)

<img src="./frontend/public/images/screens.gif">

## What I Built

The original ProShop is a MERN stack e-commerce app with Redux. I forked it and added a **conversational AI agent** that can perform real actions across the entire application through natural language — searching products, managing orders, handling the cart, navigating pages, and more.

### AI Agent Features

- **Tool-calling architecture** — The agent uses structured tool definitions (not prompt hacking) to interact with the app's APIs
- **SSE streaming** — Real-time streamed responses with status indicators during tool execution
- **Frontend actions** — The agent can dispatch Redux actions (add to cart, navigate) directly in the browser
- **Confirmation flow** — Destructive actions (delete product, etc.) require user confirmation before execution
- **Multi-tool chaining** — The agent can chain multiple tools in a single conversation turn
- **Role-aware** — Different capabilities for regular users vs. admins

### Agent Capabilities

| Category | Actions |
|----------|---------|
| Products | Search, create, update, delete |
| Orders | View, track, mark delivered |
| Users | Profile management, admin user management |
| Cart | Add, remove, clear — via conversation |
| Navigation | Route to any page in the app |

### Architecture

```
User message → LLM (with tool definitions) → Tool execution → Streamed response
                    ↕                              ↕
              Provider-agnostic              Backend API calls
              adapter layer                  + Frontend dispatches
```

**Key components I built:**
- `backend/agent/` — Agent engine, tool registry, tool definitions, streaming pipeline
- `backend/agent/llm/` — Provider-agnostic LLM adapter layer (supports OpenAI-compatible, Anthropic, Z.ai, Groq, etc.)
- `frontend/src/components/AgentChat/` — Chat widget (8 components) with SSE streaming, tool result rendering, confirmation dialogs
- `backend/utils/resetDb.js` — Hourly database reset for the live demo

### Demo Mode

The app runs as a portfolio demo:
- Welcome modal with demo credentials on first visit
- Hourly database reset via `node-cron` — experiment freely
- Registration disabled (demo accounts only)
- Login guard on the chat widget with friendly error messages

---

## Original ProShop Features

All original features from Brad Traversy's course project are preserved:

- Full featured shopping cart
- Product reviews and ratings
- Top products carousel
- Product pagination & search
- User profile with orders
- Admin product/user/order management
- Checkout process (shipping, payment method, etc.)
- PayPal / credit card integration
- Database seeder (products & users)

## Tech Stack

- **Frontend:** React, Redux Toolkit, RTK Query, React Bootstrap, React Router v6
- **Backend:** Node.js, Express, MongoDB, Mongoose
- **AI Layer:** OpenAI-compatible LLM API, tool-calling, SSE streaming
- **Infrastructure:** node-cron (DB reset), cookie-based JWT auth

## Usage

### Env Variables

Rename `.env.example` to `.env` and add:

```
NODE_ENV = development
PORT = 5000
MONGO_URI = your mongodb uri
JWT_SECRET = 'abc123'
PAYPAL_CLIENT_ID = your paypal client id
PAGINATION_LIMIT = 8
LLM_PROVIDER = your llm provider
LLM_API_KEY = your llm api key
LLM_MODEL = your model name
```

### Install Dependencies (frontend & backend)

```
npm install
cd frontend
npm install
```

### Run

```
# Run frontend (:3000) & backend (:5000)
npm run dev

# Run backend only
npm run server
```

### Seed Database

```
# Import data
npm run data:import

# Destroy data
npm run data:destroy
```

### Sample User Logins

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@email.com | 123456 |
| Customer | john@email.com | 123456 |
| Customer | jane@email.com | 123456 |

---

## Credits

- Original ProShop app by [Brad Traversy](https://github.com/bradtraversy/proshop-v2) (MIT License)
- AI agent layer, demo mode, and streaming architecture by [Anand Bhagat](https://github.com/anand-bhagat)

## License

The MIT License — see the original [LICENSE](https://github.com/bradtraversy/proshop-v2/blob/main/LICENSE) from Brad Traversy's repository.
