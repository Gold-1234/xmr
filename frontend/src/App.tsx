import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Dashboard from './components/Dashboard';
import ReportsPage from './components/ReportsPage';
import ReportDetail from './components/ReportDetail';
import TrendChart from './components/TrendChart';
import LoginPage from './components/LoginPage';
import OTPVerification from './components/OTPVerification';
import UserOnboarding from './components/UserOnboarding';
import GoogleVisionExtractor from './components/GoogleVisionExtractor';

type Page = 'login' | 'otp' | 'onboarding' | 'dashboard' | 'reports' | 'report-detail' | 'trends' | 'google-vision';

function AppContent() {
  const { user, login, updateProfile, isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('login'); // Start on login page
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [loginEmail, setLoginEmail] = useState<string>('');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  // Check if user is authenticated and redirect appropriately
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.profile) {
        setCurrentPage('dashboard');
      } else {
        setCurrentPage('onboarding');
      }
    }
  }, [isAuthenticated, user]);

  // Login flow handlers
  const handleLoginSubmit = async (email: string, password: string) => {
    // Call send-otp Supabase function
    const response = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send OTP');
    }

    setLoginEmail(email);
    setCurrentPage('otp');
  };

  const handleOTPVerify = () => {
    // For demo purposes, create a mock user since we don't have full Supabase auth
    login({
      id: 'demo-user-id',
      email: loginEmail,
    });
  };

  const handleOnboardingComplete = (profile: any) => {
    updateProfile(profile);
    setCurrentPage('dashboard');
  };

  // Navigation handlers
  const goToDashboard = () => setCurrentPage('dashboard');
  const goToReports = () => setCurrentPage('reports');
  const goToGoogleVision = () => setCurrentPage('google-vision');
  const goToReportDetail = (reportId: string) => {
    setSelectedReportId(reportId);
    setCurrentPage('report-detail');
  };
  const goToTrends = (testName: string) => {
    setSelectedTest(testName);
    setCurrentPage('trends');
  };
  const goBackToReports = () => setCurrentPage('reports');

  // File upload handler
  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${backendUrl}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }

    // Use the Cloudinary URL returned by backend for all file types
    const backendFileUrl = data.fileUrl;

    // For display, prefer Cloudinary URL, fallback to blob URL only for localhost URLs
    let displayUrl = backendFileUrl;
    if (backendFileUrl.startsWith('http://localhost') || backendFileUrl.startsWith('blob:')) {
      displayUrl = URL.createObjectURL(file);
    }

    return {
      fileUrl: displayUrl,
      originalFileUrl: backendFileUrl, // Always store the backend URL for saving
      patient: data.patient,
      tests: data.tests
    };
  };

  // Main app rendering
  if (!isAuthenticated) {
    if (currentPage === 'login') {
      return <LoginPage onLoginSubmit={handleLoginSubmit} />;
    }

    if (currentPage === 'otp') {
      return <OTPVerification email={loginEmail} onVerify={handleOTPVerify} />;
    }
  }

  if (isAuthenticated && user) {
    if (currentPage === 'onboarding') {
      return <UserOnboarding onComplete={handleOnboardingComplete} />;
    }

    if (currentPage === 'dashboard') {
      return <Dashboard onFileUpload={handleFileUpload} onGoToReports={goToReports} onGoToGoogleVision={goToGoogleVision} />;
    }
  }

  if (currentPage === 'reports' && user) {
    return <ReportsPage onBack={goToDashboard} onViewTrends={goToTrends} onViewReport={goToReportDetail} />;
  }

  if (currentPage === 'report-detail' && user) {
    return <ReportDetail reportId={selectedReportId} onBack={goBackToReports} />;
  }

  if (currentPage === 'trends' && user) {
    return <TrendChart testName={selectedTest} onBack={goBackToReports} />;
  }

  if (currentPage === 'google-vision') {
    return <GoogleVisionExtractor />;
  }

  // Default fallback
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
