# XMR - Medical Report Analyzer & Health Management Platform

A comprehensive AI-powered health management platform that analyzes medical reports, tracks health trends, and connects patients with healthcare services. Features OCR technology for document processing, intelligent AI analysis, and seamless doctor appointment booking.

## 🌟 Key Features

- 🏥 **Doctor Appointment Booking** - Book appointments with doctors via Practo API integration
- 📊 **Health Trend Visualization** - Plot and track any health metric over time (glucose, cholesterol, blood pressure, etc.)
- 📄 **Multi-format Report Processing** - OCR-powered analysis of PDFs, images, and scanned documents
- 🧠 **AI Medical Analysis** - Gemini & OpenAI powered intelligent health insights
- 🔍 **Comprehensive Health Tracking** - Store and analyze historical medical data
- 📈 **Interactive Charts** - Visualize health trends with beautiful, responsive graphs
- 🔐 **Secure Authentication** - OTP-based login with Supabase
- ☁️ **Cloud Storage** - Secure file storage with Cloudinary integration

## 🏗️ Architecture

This project consists of two main components:

### Backend (Python Flask)
- **OCR Processing**: Uses Tesseract OCR with OpenCV preprocessing for image analysis
- **PDF Processing**: Extracts text from PDF documents using pdfplumber and PyMuPDF
- **AI Analysis**: Uses Google Gemini AI to extract structured medical data and generate explanations
- **REST API**: Provides endpoints for file upload and analysis

### Frontend (React + TypeScript)
- **User Interface**: Modern web interface with authentication
- **File Upload**: Drag-and-drop file upload functionality
- **Dashboard**: Displays analysis results with interactive components
- **Authentication**: OTP-based login system using Supabase

## 🚀 Features

### 🏥 Doctor Appointment Booking
- **Practo API Integration**: Seamlessly book appointments with doctors through Practo
- **Real-time Availability**: Check doctor schedules and book slots instantly
- **Specialty-based Search**: Find doctors by specialty (cardiologist, endocrinologist, etc.)
- **Location-based Results**: Get doctors near your location
- **Appointment Management**: View, reschedule, or cancel appointments

### 📊 Health Trend Visualization
- **Interactive Charts**: Plot any health metric over time with beautiful, responsive graphs
- **Glucose Tracking Example**: Monitor blood glucose levels across multiple tests
- **Multi-parameter Tracking**: Track cholesterol, blood pressure, hemoglobin, etc.
- **Date Range Selection**: View trends for custom time periods (last month, 3 months, year)
- **Trend Analysis**: Identify patterns and health improvements over time
- **Export Charts**: Download graphs for medical consultations

### Core Analysis Features
- 📄 **Multi-format Support**: Processes both PDF and image files
- 🔍 **OCR Technology**: Advanced text extraction from scanned documents
- 🧠 **AI Analysis**: Intelligent interpretation of medical test results
- 📊 **Reference Ranges**: Compares results against standard medical reference ranges
- 🔐 **Secure Authentication**: OTP-based user authentication
- 📱 **Responsive Design**: Works on desktop and mobile devices
- ☁️ **Cloud Backend**: Uses Supabase for database and authentication

## 🛠️ Tech Stack

### Backend
- **Python 3.12**
- **Flask** - Web framework
- **Tesseract OCR** - Optical character recognition
- **OpenCV** - Image preprocessing
- **pdfplumber** - PDF text extraction
- **PyMuPDF** - Alternative PDF processing

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Supabase** - Backend as a service
- **Lucide React** - Icons

## 📁 Project Structure

```
health_report_analyzer/
├── server.py                    # Flask API server
├── main.py                      # Main analysis logic
├── requirements.txt             # Python dependencies
├── modules/                     # Python modules
│   ├── analyzer.py             # Medical analysis logic
│   ├── ocr_reader.py           # OCR processing
│   ├── pdf_reader.py           # PDF text extraction
│   └── text_cleaner.py         # Text preprocessing
├── frontend/                   # React application
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── contexts/          # React contexts
│   │   └── lib/               # Utilities
│   ├── backend/               # Express.js routes
│   ├── supabase/              # Supabase functions
│   └── package.json           # Node dependencies
└── README.md                  # This file
```

## 🏃‍♂️ Getting Started

### Prerequisites

- **Python 3.12+**
- **Node.js 18+**
- **Tesseract OCR** (see installation below)
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
   cd health_report_analyzer

   # Create virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate

   # Install dependencies
   pip install -r requirements.txt
   ```

3. **Run the Flask backend**:
   ```bash
   python server.py
   ```
   The API will be available at `http://localhost:5000`

### Frontend Setup

1. **Install Node.js dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Setup environment variables**:
   Create a `.env.local` file in the `frontend/` directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`

### Running Both Services

For development, you can run both frontend and backend simultaneously:

```bash
# Terminal 1 - Backend
cd health_report_analyzer
source venv/bin/activate
python server.py

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## 📡 API Endpoints

### Backend API (Flask)

#### Core Analysis
- `POST /upload` - Upload and analyze health report files
  - Accepts: `multipart/form-data` with `file` field
  - Returns: JSON with analysis results
- `GET /reports/<user_id>` - Get user's saved medical reports
- `GET /report/<report_id>` - Get detailed report information
- `DELETE /report/<report_id>` - Delete a medical report

#### Health Trends & Visualization
- `GET /trends/<user_id>/<test_name>` - Get trend data for specific health metrics
  - Example: `/trends/user123/glucose` - Returns glucose levels over time
- `GET /stats/<user_id>` - Get comprehensive health statistics

#### Doctor Appointment Booking
- `GET /doctors/search` - Search doctors by specialty and location
  - Parameters: `specialty`, `location`, `date`
- `POST /appointments/book` - Book appointment via Practo API
  - Body: `{doctor_id, date, time, user_details}`
- `GET /appointments/<user_id>` - Get user's appointments
- `PUT /appointments/<appointment_id>` - Reschedule appointment
- `DELETE /appointments/<appointment_id>` - Cancel appointment

### Frontend API Routes

- `/` - Landing page with authentication
- `/dashboard` - Main dashboard for file upload and analysis
- `/reports` - View all saved medical reports
- `/trends` - Interactive health trend charts and graphs
- `/appointments` - Doctor appointment booking and management
- `/otp` - OTP verification page

## 🔧 Configuration

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key
3. Run the SQL migrations in `frontend/supabase/migrations/`
4. Deploy the edge functions in `frontend/supabase/functions/`

### Environment Variables

Create `.env` in the root directory for backend:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Create `.env.local` in the frontend directory:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Gemini AI Setup

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env` file as `GEMINI_API_KEY`

## 📊 AI-Powered Analysis

The system uses Google Gemini AI to automatically:
- Extract patient information (name, age, gender)
- Identify and parse all medical test results from documents
- Determine normal/high/low interpretations based on reference ranges
- Generate clear explanations for each test result

The AI can handle any blood test, diagnostic report, or medical document, automatically adapting to different formats and test types.

## 🔒 Security Features

- OTP-based authentication
- Secure file upload handling
- Input validation and sanitization
- CORS protection
- Environment variable management

## 🚀 Deployment

### Backend Deployment
```bash
# Using Docker
docker build -t health-analyzer .
docker run -p 5000:5000 health-analyzer

# Or deploy to Heroku, Railway, etc.
```

### Frontend Deployment
```bash
cd frontend
npm run build
# Deploy dist/ folder to Netlify, Vercel, etc.
```

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
- [Supabase](https://supabase.com/) for backend services
- [React](https://reactjs.org/) for the frontend framework

## 📞 Support

For questions or issues, please open an issue on GitHub or contact the maintainers.
