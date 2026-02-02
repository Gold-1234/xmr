# XMR - Advanced Medical Report Analyzer

A comprehensive AI-powered health management platform featuring advanced medical report analysis, real-time voice conversations with AI medical assistants, health trend tracking, and seamless healthcare services. Combines OCR technology, intelligent AI analysis, LiveKit-powered voice agents, and secure cloud storage.

## 🌟 Key Features

### 🎤 **AI Voice Medical Assistant**
- **Real-time Voice Conversations** - Talk naturally with AI medical assistant using LiveKit WebRTC
- **Cartesia Professional Voice** - High-quality Text-to-Speech with medical assistant voice synthesis
- **Google Speech Recognition** - Accurate Speech-to-Text with auto language detection
- **Automatic Agent Dispatch** - AI joins rooms automatically when users connect
- **Medical Context Awareness** - Voice assistant understands medical terminology
- **Interactive Q&A** - Ask about symptoms, medications, and test results verbally

### 🏥 **Advanced Medical Report Analysis**
- **Multi-format Processing** - PDFs, images, scanned documents, and text files
- **Dual OCR Technology** - Tesseract OCR with OpenCV preprocessing + Google Cloud Vision OCR
- **AI-Powered Extraction** - Google Gemini AI and OpenAI GPT automatically identify and parse medical tests
- **Reference Range Analysis** - Compares results against standard medical ranges with age-based adjustments
- **Intelligent Interpretations** - Normal/High/Low classifications with AI-generated explanations
- **Patient Information Extraction** - Auto-detects patient demographics (name, age, gender)

### 📊 **Comprehensive Health Tracking**
- **Interactive Trend Charts** - Visualize any health metric over time using Chart.js
- **Multi-parameter Tracking** - Glucose, cholesterol, blood pressure, hemoglobin, creatinine, etc.
- **Date-based Organization** - Group tests by date for better analysis and historical tracking
- **Historical Data Storage** - Securely store all medical reports in Supabase PostgreSQL
- **Trend Analysis** - Identify patterns and health improvements over time
- **Personalized Health Insights** - BMI calculation, health summaries, and recommendations

### 🔐 **Enterprise-Grade Security**
- **OTP Authentication** - Secure Supabase OTP-based login with email verification
- **JWT Token Management** - Proper authentication for LiveKit voice sessions
- **Secure File Upload** - Cloudinary integration with access controls and permanent storage
- **Data Privacy** - HIPAA-compliant medical data handling with Row Level Security
- **Input Validation** - Comprehensive sanitization and validation

### ☁️ **Cloud-Native Architecture**
- **Supabase Backend** - PostgreSQL database with real-time subscriptions and Edge Functions
- **Cloudinary Storage** - Secure medical document storage and delivery with OCR capabilities
- **LiveKit Cloud** - Real-time voice infrastructure with WebRTC
- **Scalable Deployment** - Docker containerization ready for cloud deployment

### 🤖 **AI-Powered Intelligence**
- **Personalized Analysis** - User profile integration (age, body type, goals, medical history)
- **Dietary Recommendations** - AI-generated nutrition suggestions based on test results
- **Lifestyle Guidance** - Personalized exercise and wellness recommendations
- **Medical Report Summaries** - Comprehensive health assessments with concerning findings
- **Trend-Based Insights** - Longitudinal health pattern recognition

## 🏗️ Architecture

This project consists of two main components:

### Backend (Python Flask)
- **OCR Processing**: Tesseract OCR with OpenCV preprocessing for image analysis
- **PDF Processing**: Extracts text from PDF documents using PyMuPDF and pdfplumber
- **AI Analysis**: Uses Google Gemini AI and OpenAI GPT-4 for intelligent medical data extraction
- **Voice Integration**: LiveKit agents for real-time voice conversations
- **Database**: Supabase PostgreSQL with Row Level Security
- **File Storage**: Cloudinary for secure medical document storage

### Frontend (React + TypeScript)
- **User Interface**: Modern web interface built with React 18 and TypeScript
- **Authentication**: OTP-based login system with Supabase auth
- **File Upload**: Drag-and-drop file upload with multi-format support
- **Dashboard**: Comprehensive health dashboard with BMI calculator and profile management
- **Reports Management**: View, organize, and analyze saved medical reports
- **Trend Visualization**: Interactive charts for health metric tracking
- **Voice Interface**: LiveKit-powered real-time voice conversations

## 🛠️ Tech Stack

### Backend
- **Python 3.12** - Core programming language
- **Flask** - Web framework with CORS support
- **Tesseract OCR** - Primary OCR engine for image processing
- **OpenCV** - Image preprocessing and enhancement
- **PyMuPDF** - PDF text extraction and page rendering
- **Google Gemini AI** - Primary AI model for medical analysis
- **OpenAI GPT-4** - Fallback AI model for comprehensive analysis
- **Supabase** - Backend-as-a-Service with PostgreSQL and auth
- **Cloudinary** - Cloud storage with OCR capabilities
- **LiveKit Agents** - Real-time voice infrastructure
- **Cartesia** - Professional text-to-speech synthesis

### Voice Assistant
- **LiveKit Agents** - Real-time voice infrastructure
- **Cartesia TTS** - Professional voice synthesis (sonic-english model)
- **Google Speech-to-Text** - Accurate speech recognition with auto language detection
- **WebRTC Audio** - Real-time audio streaming
- **Silero VAD** - Voice Activity Detection
- **Multilingual Support** - Automatic language detection and processing

### Frontend
- **React 18** - UI framework with hooks and concurrent features
- **TypeScript** - Type safety and enhanced developer experience
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Supabase JS** - Frontend client for auth and database
- **LiveKit React** - Voice components and room management
- **Chart.js + React-ChartJS-2** - Interactive data visualization
- **Lucide React** - Modern icon library
- **React Router** - Client-side routing

### Infrastructure
- **Supabase PostgreSQL** - Primary database with RLS
- **Supabase Edge Functions** - Serverless functions for auth (send-otp, verify-otp)
- **Cloudinary** - Media storage and CDN
- **Google Cloud Vision** - Advanced OCR for PDF processing
- **LiveKit Cloud** - Real-time communication platform
- **Docker** - Containerization for deployment

## 📁 Project Structure

```
xmr/
├── server.py                    # Flask API server with all endpoints
├── main.py                      # Main analysis orchestration logic
├── livekit_agent.py             # LiveKit voice agent implementation
├── delete_rooms.py              # LiveKit room cleanup utility
├── wsgi.py                      # WSGI entry point for deployment
├── requirements.txt             # Python dependencies
├── Dockerfile                   # Containerization config
├── render.yaml                  # Cloud deployment config
├── .env                         # Environment variables (backend)
├── xmr.json                     # Google Cloud Vision credentials
├── .gitignore                   # Git ignore rules
├── modules/                     # Python backend modules
│   ├── __init__.py
│   ├── analyzer.py             # AI analysis and medical logic
│   ├── ocr_reader.py           # Tesseract OCR processing
│   ├── pdf_reader.py           # PDF text extraction
│   ├── text_cleaner.py         # Text preprocessing utilities
│   └── database.py             # Supabase database operations
├── uploads/                    # Temporary file storage
├── frontend/                   # React application
│   ├── package.json            # Node dependencies
│   ├── vite.config.ts          # Vite configuration
│   ├── tailwind.config.js      # Tailwind CSS config
│   ├── tsconfig.json           # TypeScript configuration
│   ├── .env.local              # Frontend environment variables
│   ├── index.html              # Main HTML template
│   ├── src/
│   │   ├── main.tsx           # React entry point
│   │   ├── App.tsx            # Main app component with routing
│   │   ├── index.css          # Global styles
│   │   ├── vite-env.d.ts      # Vite type definitions
│   │   ├── components/        # React components
│   │   │   ├── Dashboard.tsx          # Main dashboard with upload
│   │   │   ├── LoginPage.tsx          # Authentication page
│   │   │   ├── OTPVerification.tsx    # OTP verification
│   │   │   ├── UserOnboarding.tsx     # Profile setup
│   │   │   ├── Report.tsx             # Analysis results display
│   │   │   ├── ReportDetail.tsx       # Individual report view
│   │   │   ├── ReportsPage.tsx        # Reports management
│   │   │   ├── TrendChart.tsx         # Health trends visualization
│   │   │   ├── VoiceAgent.tsx         # LiveKit voice interface
│   │   │   ├── GoogleVisionExtractor.tsx # PDF OCR tool
│   │   │   ├── TestExplanationModal.tsx
│   │   │   └── CloudinaryTest.tsx     # Storage testing
│   │   └── contexts/
│   │       └── AuthContext.tsx        # Authentication state
│   └── supabase/              # Supabase configuration
│       ├── functions/         # Edge functions
│       │   ├── send-otp/      # OTP email sending
│       │   ├── verify-otp/    # OTP verification
│       │   └── upload-report/ # Report processing
│       └── migrations/        # Database schema
│           ├── 20251118162408_create_auth_and_reports_schema.sql
│           └── 20251118162409_add_test_results_table.sql
├── assets/                    # Static assets for testing
└── KMS/                       # Key Management System (logs)
```

## 🚀 Getting Started

### Prerequisites

- **Python 3.12+**
- **Node.js 18+**
- **Tesseract OCR** (for image processing)
- **Git**

### Backend Setup

1. **Install Tesseract OCR** (required for image processing):
   ```bash
   # macOS
   brew install tesseract

   # Ubuntu/Debian
   sudo apt-get install tesseract-ocr

   # Windows
   # Download from: https://github.com/UB-Mannheim/tesseract/wiki
   ```

2. **Clone and setup Python environment**:
   ```bash
   git clone https://github.com/Gold-1234/xmr.git
   cd xmr

   # Create virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate

   # Install dependencies
   pip install -r requirements.txt
   ```

3. **Setup environment variables**:
   Create a `.env` file in the root directory:
   ```env
   # Supabase Configuration
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # AI APIs (choose one or both)
   GEMINI_API_KEY=your-gemini-api-key
   OPENAI_API_KEY=your-openai-api-key

   # Cloud Storage
   CLOUDINARY_URL=cloudinary://your-cloudinary-credentials

   # Google Cloud Vision (optional, for advanced PDF OCR)
   GOOGLE_APPLICATION_CREDENTIALS=xmr.json

   # LiveKit Configuration (for voice assistant)
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=your-livekit-api-key
   LIVEKIT_API_SECRET=your-livekit-api-secret

   # Voice Service (Cartesia)
   CARTESIA_API_KEY=your-cartesia-api-key

   # Server Configuration
   PORT=5001
   ```

4. **Run the Flask backend**:
   ```bash
   python server.py
   ```
   The API will be available at `http://localhost:5001`

### Frontend Setup

1. **Install Node.js dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Setup environment variables**:
   Create a `.env.local` file in the `frontend/` directory:
   ```env
   # Supabase Configuration
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key

   # Backend URL
   VITE_BACKEND_URL=http://localhost:5001

   # LiveKit Configuration (for voice assistant)
   VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
   VITE_LIVEKIT_API_KEY=your-livekit-api-key
   VITE_LIVEKIT_API_SECRET=your-livekit-api-secret

   # Voice Service (Cartesia)
   VITE_CARTESIA_API_KEY=your-cartesia-api-key
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`

### LiveKit Voice Assistant Setup

1. **Create a LiveKit Cloud project** at [cloud.livekit.io](https://cloud.livekit.io)
2. **Get your API credentials** (API Key, API Secret, WebSocket URL)
3. **Configure Cartesia** for voice synthesis at [cartesia.ai](https://cartesia.ai)
4. **Add credentials to environment variables** (see above)
5. **Start the voice agent server**:
   ```bash
   # Terminal 3 - Voice Agent
   python livekit_agent.py dev
   ```

### Running All Services

For development, you can run both frontend and backend simultaneously:

```bash
# Terminal 1 - Backend
python server.py

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - Voice Agent (optional)
python livekit_agent.py dev
```

## 📡 API Endpoints

### Authentication
- `POST /auth/send-otp` - Send OTP to email for authentication
- `POST /auth/verify-otp` - Verify OTP and create session

### Medical Report Analysis
- `POST /upload` - Upload and analyze medical reports (PDF/image)
  - Supports multi-format processing with OCR
  - Returns structured analysis with AI explanations
  - Optional fast mode for quick results
- `POST /save-report` - Save analyzed report to database
- `GET /reports/<user_id>` - Get user's saved reports (paginated)
- `GET /report/<report_id>` - Get detailed report information
- `DELETE /report/<report_id>` - Delete a medical report

### Health Trends & Analytics
- `GET /trends/<user_id>/<test_name>` - Get trend data for specific health metrics
- `GET /stats/<user_id>` - Get comprehensive health statistics
- `POST /download-txt` - Generate downloadable text summary of test results

### Voice Assistant
- `POST /voice-chat` - AI-powered voice conversation about medical topics
  - Supports both text and voice input
  - Context-aware responses based on report data
  - General health advice when no reports available

### Advanced OCR
- `POST /extract-pdf-info` - Google Cloud Vision PDF processing
  - Page-by-page OCR analysis
  - Date and report type extraction
  - Structured metadata extraction

### Utility Endpoints
- `GET /proxy-image` - Proxy images from external URLs (CORS bypass)
- `GET /test-db` - Database connection testing
- `GET /test-users` - User table verification

## 🔧 Configuration

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your project URL and API keys
3. Run the SQL migrations in `frontend/supabase/migrations/`
4. Deploy the edge functions in `frontend/supabase/functions/`

### AI API Setup

**Google Gemini (Primary):**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add to `.env` as `GEMINI_API_KEY`

**OpenAI GPT-4 (Fallback):**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add to `.env` as `OPENAI_API_KEY`

### Cloudinary Setup

1. Create account at [cloudinary.com](https://cloudinary.com)
2. Get your cloud name, API key, and API secret
3. Add to `.env` as `CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME`

### Google Cloud Vision (Optional)

1. Create a Google Cloud Project
2. Enable the Vision API
3. Create a service account and download credentials JSON
4. Save as `xmr.json` in project root
5. Set `GOOGLE_APPLICATION_CREDENTIALS=xmr.json`

## 🔒 Security Features

- **OTP Authentication** - Email-based OTP with 5-minute expiration
- **Row Level Security** - Database policies ensure users only access their data
- **JWT Tokens** - Secure session management
- **Input Validation** - Comprehensive sanitization of all inputs
- **CORS Protection** - Configured for secure cross-origin requests
- **Environment Variables** - Sensitive data stored securely
- **File Upload Security** - Type validation and secure storage

## 🚀 Deployment

### Backend Deployment

**Using Docker:**
```bash
docker build -t xmr-backend .
docker run -p 5001:5001 xmr-backend
```

**Cloud Platforms:**
- **Render**: Use `render.yaml` configuration
- **Railway**: Direct Python deployment
- **Heroku**: Buildpack deployment
- **AWS/GCP**: Container deployment

### Frontend Deployment

**Vercel/Netlify:**
```bash
cd frontend
npm run build
# Deploy dist/ folder to your hosting platform
```

**Environment Variables:**
Ensure all `VITE_` prefixed variables are set in your deployment platform.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) for optical character recognition
- [OpenCV](https://opencv.org/) for image processing
- [Google Gemini AI](https://ai.google.dev/) for intelligent medical analysis
- [OpenAI](https://openai.com/) for advanced AI capabilities
- [Supabase](https://supabase.com/) for backend infrastructure
- [LiveKit](https://livekit.io/) for real-time voice communication
- [Cartesia](https://cartesia.ai/) for professional voice synthesis
- [Cloudinary](https://cloudinary.com/) for media storage and processing

## 📞 Support

For questions or issues, please open an issue on GitHub or contact the maintainers.

---

**Built with ❤️ for better healthcare accessibility**