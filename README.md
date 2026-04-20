# XMR - Advanced Medical Report Analyzer

An AI-powered health management platform that analyzes medical reports, tracks health trends over time, and provides real-time voice conversations with an AI medical assistant. Powered entirely by Google Gemini 2.5 Flash Lite for both OCR and intelligent analysis.

## Features

### AI Medical Report Analysis
- **Multi-format Support** — PDFs, images (JPG, PNG), and scanned documents
- **Gemini Vision OCR** — Extracts text from medical report images using Gemini 2.5 Flash Lite
- **OpenCV Preprocessing** — 6-technique image enhancement pipeline as fallback for low-quality scans
- **Structured Data Extraction** — Automatically identifies test names, values, units, reference ranges, and patient info
- **Reference Range Analysis** — Normal / High / Low classification with age-based adjustments
- **AI Explanations** — Plain-language explanations for each test result
- **Multi-date Reports** — Detects and groups tests from multiple dates within a single PDF

### Health Trend Tracking
- **Interactive Charts** — Visualize any health metric over time (Chart.js)
- **Historical Storage** — All reports saved to Supabase PostgreSQL
- **Personalized Insights** — BMI, health summaries, dietary and lifestyle recommendations based on profile

### Real-time Voice Assistant
- **LiveKit WebRTC** — Real-time voice conversations with AI medical assistant
- **Cartesia TTS** — Professional voice synthesis
- **Google STT** — Speech-to-text with automatic language detection
- **Medical Context** — Voice assistant understands terminology and references your report data

### Security
- **Email Authentication** — Direct email-based login with Supabase auth
- **Row Level Security** — Database policies ensure users only access their own data
- **Cloudinary Storage** — Secure medical document storage with access controls

---

## Architecture

```
Upload (image/PDF)
        │
        ▼
  ocr_reader.py  ──► Gemini 2.5 Flash Lite (Vision) ──► Raw text
  [OpenCV preprocessing fallback for low-quality images]
        │
        ▼
  analyzer.py    ──► Gemini 2.5 Flash Lite (Text) ──► Structured JSON
                     {patient, tests[], tests_by_date{}}
        │
        ▼
  server.py / Supabase PostgreSQL
```

**Single model (`gemini-2.5-flash-lite`) handles everything** — OCR, data extraction, explanations, and health summaries. No separate OCR engine or secondary AI provider.

---

## Tech Stack

### Backend
| Component | Technology |
|---|---|
| Language | Python 3.12 |
| Web Framework | Flask |
| AI / OCR | `google.genai` SDK — `gemini-2.5-flash-lite` |
| Image Preprocessing | OpenCV (6-technique pipeline) |
| PDF Processing | PyMuPDF + pdfplumber |
| Database | Supabase PostgreSQL (RLS) |
| File Storage | Cloudinary |
| Voice Infrastructure | LiveKit Agents |
| Text-to-Speech | Cartesia (`sonic-english`) |
| Speech-to-Text | Google Speech-to-Text |

### Frontend
| Component | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Charts | Chart.js + React-ChartJS-2 |
| Auth / DB Client | Supabase JS |
| Voice | LiveKit React SDK |
| Icons | Lucide React |
| Routing | React Router |

---

## Project Structure

```
xmr/
├── server.py                 # Flask API — all endpoints
├── main.py                   # Analysis orchestration
├── livekit_agent.py          # LiveKit voice agent
├── requirements.txt
├── .env.example              # Environment variable template
├── modules/
│   ├── analyzer.py           # AI analysis engine (Gemini)
│   ├── ocr_reader.py         # Image OCR (Gemini Vision + OpenCV)
│   ├── pdf_reader.py         # PDF text extraction
│   ├── text_cleaner.py       # Text preprocessing utilities
│   └── database.py           # Supabase operations
├── uploads/                  # Temporary file storage
├── test_vertex_fixes.py      # Test suite (11 sections)
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── components/
    │   │   ├── Dashboard.tsx
    │   │   ├── LoginPage.tsx
    │   │   ├── Report.tsx
    │   │   ├── ReportsPage.tsx
    │   │   ├── TrendChart.tsx
    │   │   ├── VoiceAgent.tsx
    │   │   └── GoogleVisionExtractor.tsx
    │   └── contexts/AuthContext.tsx
    └── supabase/
        ├── functions/        # Edge functions (send-otp, verify-otp)
        └── migrations/       # Database schema
```

---

## Getting Started

### Prerequisites
- Python 3.12+
- Node.js 18+
- Google AI API key (from [Google AI Studio](https://aistudio.google.com/app/apikey))

### Backend Setup

```bash
git clone https://github.com/Gold-1234/xmr.git
cd xmr

python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

Create a `.env` file:
```env
# Google AI (required — single key for all AI/OCR)
VERTEX_AI_API_KEY=your-google-ai-api-key
VERTEX_MODEL=gemini-2.5-flash-lite

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cloudinary
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME

# LiveKit
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

# Cartesia (TTS)
CARTESIA_API_KEY=your-cartesia-api-key

PORT=5001
```

```bash
python server.py
# API available at http://localhost:5001
```

### Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BACKEND_URL=http://localhost:5001
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
```

```bash
npm run dev
# Frontend available at http://localhost:5173
```

### Voice Agent (optional)

```bash
python livekit_agent.py dev
```

---

## API Endpoints

### Report Analysis
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload` | Upload and analyze a medical report (PDF/image) |
| `POST` | `/save-report` | Save analyzed report to database |
| `GET` | `/reports/<user_id>` | List user's saved reports |
| `GET` | `/report/<report_id>` | Get detailed report |
| `DELETE` | `/report/<report_id>` | Delete a report |

### Health Trends
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/trends/<user_id>/<test_name>` | Trend data for a health metric |
| `GET` | `/stats/<user_id>` | Comprehensive health statistics |
| `POST` | `/download-txt` | Download text summary of results |

### Voice & Utility
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/voice-chat` | AI voice/text conversation |
| `POST` | `/extract-pdf-info` | Page-by-page PDF OCR |
| `GET` | `/proxy-image` | Proxy external image (CORS) |

---

## Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Run migrations in `frontend/supabase/migrations/`
3. Deploy edge functions in `frontend/supabase/functions/`
4. Copy URL + keys to `.env`

---

## Deployment

### Backend (Docker)
```bash
docker build -t xmr-backend .
docker run -p 5001:5001 --env-file .env xmr-backend
```

### Backend (Render / Railway)
Use `render.yaml` or deploy directly as a Python service. Set all `.env` variables in the platform dashboard.

### Frontend (Vercel / Netlify)
```bash
cd frontend
npm run build
# Deploy dist/ folder
```

Set all `VITE_` variables in your hosting platform's environment settings.

---

## Acknowledgments

- [Google Gemini](https://ai.google.dev/) — AI model for OCR and medical analysis
- [OpenCV](https://opencv.org/) — Image preprocessing pipeline
- [Supabase](https://supabase.com/) — Backend infrastructure
- [LiveKit](https://livekit.io/) — Real-time voice communication
- [Cartesia](https://cartesia.ai/) — Professional voice synthesis
- [Cloudinary](https://cloudinary.com/) — Media storage

---

**Built for better healthcare accessibility**
