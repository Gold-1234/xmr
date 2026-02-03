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
    console.log('🔍 App useEffect - isAuthenticated:', isAuthenticated, 'user:', !!user);

    // Check if there's already a stored user to avoid overwriting
    const storedUser = localStorage.getItem('user');

    if (!isAuthenticated && !storedUser) {
      console.log('👤 No stored user found, creating test user...');
      // Only create test user if nothing is stored
      login({
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
      });
    } else if (user) {
      // Check if user has essential details (name and age) in profile
      const hasEssentialDetails = user.profile && user.profile.name && user.profile.age;
      if (hasEssentialDetails) {
        console.log('📊 User has essential details (name, age), going to dashboard');
        setCurrentPage('dashboard');
      } else {
        console.log('📝 User missing essential details, needs onboarding');
        setCurrentPage('onboarding');
      }
    }
  }, [isAuthenticated, user, login]);

  // Login flow handlers
  const handleLoginSubmit = async (email: string, password: string) => {
    // Call backend login endpoint directly
    const response = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Login failed');
    }

    // Login with user data from backend
    login({
      id: data.user.id,
      email: data.user.email,
    });

    // Go directly to dashboard or onboarding based on profile
    if (data.user.profile && data.user.profile.name && data.user.profile.age) {
      setCurrentPage('dashboard');
    } else {
      setCurrentPage('onboarding');
    }
  };

  const handleOnboardingComplete = (profile: any) => {
    console.log('✅ Onboarding completed with profile:', profile);
    // Update profile which saves to localStorage
    updateProfile(profile);
    console.log('💾 Onboarding completion saved to localStorage');
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
