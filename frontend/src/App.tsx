import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Dashboard from './components/Dashboard';
import ReportsPage from './components/ReportsPage';
import ReportDetail from './components/ReportDetail';
import TrendChart from './components/TrendChart';

type Page = 'login' | 'otp' | 'dashboard' | 'reports' | 'report-detail' | 'trends';

function AppContent() {
  const { user, login, isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard'); // Start directly on dashboard
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [selectedReportId, setSelectedReportId] = useState<string>('');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  // Auto-login with test user on app load
  useEffect(() => {
    if (!isAuthenticated) {
      // Auto-login with test user
      login({
        id: '4f6aedf0-2ecd-4ff8-bbd7-ef08743a8f23',
        email: 'test_user@gmail.com'
      });
    }
  }, [isAuthenticated, login]);

  // Check if user is authenticated and redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      setCurrentPage('dashboard');
    }
  }, [isAuthenticated, user]);

  // Navigation handlers
  const goToDashboard = () => setCurrentPage('dashboard');
  const goToReports = () => setCurrentPage('reports');
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

  // Main app rendering - always show dashboard since we auto-login
  if (currentPage === 'dashboard' && user) {
    return <Dashboard onFileUpload={handleFileUpload} onGoToReports={goToReports} />;
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

  // Loading state while auto-logging in
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
