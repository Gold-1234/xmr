# Health Report Analyzer

A comprehensive web application for analyzing health reports using OCR technology and AI-powered analysis. The system can process PDF documents and images to extract medical test results and provide interpretations.

## 🏗️ Architecture

This project consists of two main components:

### Backend (Python Flask)
- **OCR Processing**: Uses Tesseract OCR with OpenCV preprocessing for image analysis
- **PDF Processing**: Extracts text from PDF documents using pdfplumber and PyMuPDF
- **Medical Analysis**: Analyzes blood test results against reference ranges
- **REST API**: Provides endpoints for file upload and analysis

### Frontend (React + TypeScript)
- **User Interface**: Modern web interface with authentication
- **File Upload**: Drag-and-drop file upload functionality
- **Dashboard**: Displays analysis results with interactive components
- **Authentication**: OTP-based login system using Supabase

## 🚀 Features

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

- `POST /upload` - Upload and analyze health report files
  - Accepts: `multipart/form-data` with `file` field
  - Returns: JSON with analysis results

### Frontend API Routes

- `/` - Landing page with authentication
- `/dashboard` - Main dashboard for file upload and analysis
- `/otp` - OTP verification page

## 🔧 Configuration

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key
3. Run the SQL migrations in `frontend/supabase/migrations/`
4. Deploy the edge functions in `frontend/supabase/functions/`

### Environment Variables

Create `.env.local` in the frontend directory:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 📊 Supported Medical Tests

The system currently analyzes:
- **Hemoglobin** (g/dL)
- **Glucose** (mg/dL)
- **Cholesterol** (mg/dL)

Each test includes:
- Value extraction from documents
- Comparison against reference ranges
- Deviation analysis (high/low indicators)
- Medical interpretation and recommendations

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
