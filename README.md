# AI-Grievance-Redressal

> **AI-Driven Citizen Grievance Redressal System** — A platform where citizens file complaints against government services in their own language, and an AI pipeline routes them to the right department automatically.

---

## What We Are Building

A platform where citizens file complaints against government services — water, electricity, roads, sanitation — **in their own language**, using **text, voice, or a chatbot**. An AI pipeline behind the scenes:

1. Cleans the text
2. Detects the category and location
3. Scores urgency (sentiment)
4. Checks for duplicate complaints in the same area
5. Routes the grievance to the right department

Citizens track their case publicly with a **Grievance ID**. Government staff manage, assign, escalate, and resolve cases through a dense **admin dashboard**.

### One backend, two frontends

| Frontend | Audience | Design density | Mood |
|---|---|---|---|
| **Citizen Web App** | Public — elderly, low-literacy, remote users | Generous, spacious | Calm, trustworthy |
| **Government Admin Dashboard** | Internal staff, data-dense | Compact, tight | Efficient, functional |

---

## Core Problems We Solve

| Problem | Our solution |
|---|---|
| Citizens don't know which department owns a problem | AI auto-classifies and routes |
| Complaints get lost or ignored | Public Grievance ID + SLA tracking + audit trail |
| Language barrier (India has 22+ scheduled languages) | Multilingual UI + multilingual AI (Noto Sans glyph coverage) |
| Same issue filed 50 times in one street | Duplicate detection with geo + text similarity |
| Low-literacy / elderly users | Voice input, simple language, no-login submission, 44px targets |
| No trust in a "black box" | Explainable routing reasons + honest AI progress steps |

---

## Non-Negotiable Principles

These are **requirements**, not aspirations. Any feature that violates one of these is redesigned.

1. **Clarity over cleverness** — a person with a burst pipe should never think about the interface.
2. **Trust through transparency** — always show what the AI is doing and why. Never hide it.
3. **Forgiving, not punishing** — no dead ends. Every error state offers a next action.
4. **Never silently auto-route on low confidence** — below 70% confidence, show the citizen a correction step and flag for staff review.
5. **No silent failure** — if a model call fails, the grievance is still saved and queued for manual categorization. A citizen's submission is **never dropped**.
6. **Audit everything** — `status_history` on every grievance records who (AI vs staff) changed what and when.
7. **Data minimization** — no login required to submit; email/phone optional and used only for notifications.
8. **WCAG AA everywhere** — 4.5:1 contrast, keyboard navigable, focus rings, colorblind-safe status (never color alone).
9. **Explainability, not a black box** — show *why*: "Routed to Water Dept because your complaint mentions 'pipe' and 'leak'."

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Tailwind CSS | Component-driven, fast, consistent design system |
| Backend | Python — FastAPI | Async, auto OpenAPI docs, native NLP access |
| Database | MongoDB Atlas | Flexible schema, managed, free-tier friendly |
| File storage | Cloudinary | Evidence photos handled/optimized/delivered with zero storage ops |
| Auth | JWT access + refresh, passlib/bcrypt | Stateless, role-based (citizen/officer/admin) |
| AI/NLP | spaCy (NER), TF-IDF + Logistic Regression baseline | Explainable, shippable fast; upgrade path to transformers |
| Sentiment | VADER baseline | Fast, rule-based, easy to debug |
| Speech | Self-hosted `faster-whisper` `base` (in Docker) | Free, unlimited, torch-free (fits 512 MB RAM), multilingual |
| Chatbot | Rule-based state machine + Groq free-tier LLM (Llama 3.1 8B Instant) | Scripted flow always works; Groq adds free generative replies + extraction, falls back on rate-limit/outage |
| Background jobs | FastAPI BackgroundTasks → Celery/2nd service later | Start simple, scale only when load demands |
| Containerization | Docker (multi-stage image + compose) | Models baked in, local == prod, deploys as one image |
| Deployment | Vercel Hobby (free) + Render Free (Docker) + Atlas M0 (free) | The whole stack is **$0/month** |

---

## System Architecture

```
 Citizen (text / voice / chatbot)
         │
         ▼
 ┌──────────────────────────────┐
 │   FastAPI Backend            │
 │   POST /grievances           │
 └──────────────────────────────┘
         │
         ▼
 ┌──────────────────────────────┐
 │   AI Pipeline (async)        │
 │   Preprocess → NER → Classify│
 │   → Sentiment → Duplicate    │
 │   → Route                    │
 └──────────────────────────────┘
         │
         ▼
 ┌──────────────────────────────┐
 │   MongoDB Atlas              │
 │   grievances / users / ...   │
 └──────────────────────────────┘
         │
         ▼
 ┌──────────────────────────────┐
 │   Notification service       │
 │   Email / in-app             │
 └──────────────────────────────┘

 Two frontends consuming one REST API:
  ├─ Citizen React App  → Vercel/Netlify
  └─ Admin React App    → Vercel/Netlify
```

---

## The AI Pipeline

```
 Raw text (typed or STT)
    │
    ▼
 ┌───────────────┐
 │ 1. Preprocess │  lowercase, remove stopwords/noise, tokenize (spaCy)
 └───────────────┘
    │
    ▼
 ┌───────────────┐
 │ 2. NER        │  extract core issue + location mentions (spaCy)
 └───────────────┘
    │
    ▼
 ┌───────────────┐
 │ 3. Classify   │  TF-IDF + Logistic Regression → category + confidence
 └───────────────┘
    │
    ▼
 ┌───────────────┐
 │ 4. Sentiment  │  VADER → urgency High / Medium / Low
 └───────────────┘
    │
    ▼
 ┌───────────────┐
 │ 5. Duplicate  │  category + geo proximity + cosine text similarity
 └───────────────┘
    │
    ▼
 ┌───────────────┐
 │ 6. Route      │  category → department → status: submitted
 └───────────────┘
    │
    ▼
 Response to frontend (category, priority, confidence, department, correction_flag)
```

**Failure guarantee:** every step is wrapped so that if any model throws, the grievance is persisted with `status: submitted` and flagged `needs_manual_review: true`.

---

## Citizen Journey

1. Citizen lands on `/` — sees one obvious action: **File a Grievance**.
2. Chooses input method: **Type / Speak / Chat**.
3. Enters complaint (or speaks it, or chats it out).
4. Submits → instant "Received" confirmation with a **Grievance ID** (e.g. `GRV-2026-00123`).
5. AI pipeline runs in the background — frontend shows honest steps: *"Reading your complaint… Detecting category… Checking urgency…"*
6. **Correction step** (if confidence < 70%): "We think this is about Water — is that right?" Citizen confirms or edits.
7. Confirmation page shows: category, priority, department, SLA target date, Grievance ID.
8. Citizen tracks status anytime via `/track/:id` — timeline: `Submitted → Reviewed → Assigned → In Progress → Resolved`.
9. Feedback at resolution.

---

## Admin Journey

1. Staff log in → KPI dashboard (open, overdue, SLA-breach counters + heatmap).
2. Grievances table with duplicate + overdue flags, filters, sorting.
3. Open case detail → AI insights panel (category, confidence, matched keywords, sentiment).
4. Workload-aware assign to an officer → status workflow → resolve.
5. Analytics page: trends, model performance, false-routing rates.

---

## What We Ship

### MVP (must work end-to-end, text only)
- Auth (register/login/refresh)
- Grievance submission (typed text) + Cloudinary evidence upload
- AI pipeline v1: TF-IDF + Logistic Regression classification, VADER sentiment
- Public tracking page + status timeline
- Admin: grievances table → case detail → assign → status workflow

### Phase 2 (core loop solid)
- Voice input (STT)
- Chatbot flow
- Duplicate detection
- Notifications (email/in-app)

### Phase 3 (polish)
- Analytics + model performance + false-routing review
- Bias monitoring per category/region
- Escalation workflows, SLA breach automation

---

## Success Metrics

- **Submission success rate** — % of submissions that make it through without drop/failure (target > 99.5%).
- **First-time resolution** — grievances resolved without back-and-forth.
- **Correct routing rate** — % routed correctly on first attempt (what we monitor on the Analytics page).
- **Median time to assignment** — from submission to staff pickup.
- **SLA breach rate** — % past target resolution date.
- **Correction-step rate** — % of submissions hitting the low-confidence correction prompt (if too high, model needs tuning).
- **Accessibility conformance** — no page ships without passing the Accessibility checklist.

---

## Getting Started

### Prerequisites
- Node.js >= 18
- Python >= 3.10
- MongoDB Atlas account
- Cloudinary account
- Docker & Docker Compose

### Installation

1. Clone the repository
```bash
git clone https://github.com/shubham4734singh/ai-grievance-redressal.git
cd ai-grievance-redressal
```

2. Set up environment variables
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Start the backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

4. Start the frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

---

## License

MIT
