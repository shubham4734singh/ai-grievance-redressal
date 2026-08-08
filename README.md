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
| Containerization | **Docker** (multi-stage image + compose) | Models baked in, local == prod, deploys as one image |
| Deployment | Vercel Hobby (free) + Render Free (Docker) + Atlas M0 (free) | The whole stack is **$0/month** |

---

## Getting Started with Docker

### Prerequisites
- Docker & Docker Compose installed
- Node.js >= 18 (for frontend development)

### Quick Start

1. Clone the repository
```bash
git clone https://github.com/shubham4734singh/ai-grievance-redressal.git
cd ai-grievance-redressal
```

2. Configure Environment Variables
You MUST create a `.env` file in the `backend/` directory before running the application.
```bash
cd backend
cp .env.example .env
# IMPORTANT: Open the .env file and fill in your GROQ_API_KEY and CLOUDINARY credentials!
cd ..
```

3. Start all services with Docker Compose
```bash
docker compose up --build -d
```

4. Access the application
- Frontend: http://localhost:5173 (or http://localhost:3000 depending on Vite port)
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- MongoDB: localhost:27017

### Docker Commands

```bash
# Start services in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild images
docker-compose build --no-cache
```

---

## Project Structure

```
ai-grievance-redressal/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   └── app/
│       ├── api/
│       │   ├── health.py
│       │   ├── grievances.py
│       │   └── auth.py
│       ├── core/
│       │   ├── config.py
│       │   └── database.py
│       ├── models/
│       └── services/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── components/
│       ├── pages/
│       ├── services/
│       └── utils/
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## Manual Setup (without Docker)

### Backend

1. Navigate to backend directory
```bash
cd backend
```

2. Create virtual environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies
```bash
pip install -r requirements.txt
```

4. Set environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. Run the server
```bash
uvicorn main:app --reload
```

### Frontend

1. Navigate to frontend directory
```bash
cd frontend
```

2. Install dependencies
```bash
npm install
```

3. Start development server
```bash
npm run dev
```

---

## Environment Variables

### Backend (.env)
```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=grievance_redressal
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
GROQ_API_KEY=your-groq-api-key
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

---

## License

MIT
