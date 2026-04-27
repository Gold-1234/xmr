import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ReportsPage from './components/ReportsPage';
import ReportDetail from './components/ReportDetail';
import TrendChart from './components/TrendChart';
import LoginPage from './components/LoginPage';
import UserOnboarding from './components/UserOnboarding';
import VoiceAgent from './components/VoiceAgent';
import { backendUrl, formatRequestError, readJsonResponse } from './utils/api';

type Page = 'login' | 'onboarding' | 'dashboard' | 'reports' | 'report-detail' | 'trends' | 'voice';

function AppContent() {
  const { user, login, updateProfile, isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [selectedReportId, setSelectedReportId] = useState<string>('');

  useEffect(() => {
    if (user) {
      const hasProfile = user.profile && user.profile.name && user.profile.age;
      setCurrentPage(hasProfile ? 'dashboard' : 'onboarding');
    } else {
      setCurrentPage('login');
    }
  }, [isAuthenticated, user]);

  const handleLoginSubmit = async (email: string, password: string) => {
    try {
      const response = await fetch(`${backendUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await readJsonResponse<any>(response);
      if (!response.ok) throw new Error(data?.error || `Login failed (${response.status})`);
      if (!data.success) throw new Error(data.message || 'Login failed');
      login({ id: data.user.id, email: data.user.email });
    } catch (error) {
      throw formatRequestError(error, 'log in');
    }
  };

  const handleOnboardingComplete = (profile: any) => {
    updateProfile(profile);
    setCurrentPage('dashboard');
  };

  const handleNavigate = (page: string) => {
    if (page === 'trends') {
      setSelectedTest('');
      setCurrentPage('trends');
    } else {
      setCurrentPage(page as Page);
    }
  };

  const goToReportDetail = (reportId: string) => {
    setSelectedReportId(reportId);
    setCurrentPage('report-detail');
  };

  const goToTrends = (testName: string) => {
    setSelectedTest(testName);
    setCurrentPage('trends');
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSubmit={handleLoginSubmit} />;
  }

  if (currentPage === 'onboarding') {
    return <UserOnboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {currentPage === 'dashboard' && (
        <Dashboard />
      )}
      {currentPage === 'reports' && (
        <ReportsPage
          onViewTrends={goToTrends}
          onViewReport={goToReportDetail}
        />
      )}
      {currentPage === 'report-detail' && (
        <ReportDetail
          reportId={selectedReportId}
          onBack={() => setCurrentPage('reports')}
          onViewTrends={goToTrends}
        />
      )}
      {currentPage === 'trends' && (
        <TrendChart
          initialTestName={selectedTest}
          onBack={() => setCurrentPage('reports')}
        />
      )}
      {currentPage === 'voice' && (
        <VoiceAgent patientInfo={null} extractedTests={[]} standalone />
      )}
      {!['dashboard', 'reports', 'report-detail', 'trends', 'voice'].includes(currentPage) && (
        <div className="flex items-center justify-center h-full min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-navy-800 border-t-transparent mx-auto mb-4"></div>
            <p className="text-slate-500 text-sm">Loading…</p>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
