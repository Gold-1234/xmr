import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import OTPVerification from './components/OTPVerification';
import Dashboard from './components/Dashboard';

function AppContent() {
  const { user, login } = useAuth();
  const [step, setStep] = useState<'login' | 'otp' | 'dashboard'>('login');
  const [tempEmail, setTempEmail] = useState('');
  const [displayedOtp, setDisplayedOtp] = useState('123456'); // fixed OTP for dev

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  // Login handler: just moves to OTP step
  const handleLogin = async (email: string, password: string) => {
    // In dev-mode, we skip real API call
    setTempEmail(email);
    setDisplayedOtp('123456');
    setStep('otp');
  };

  // OTP verify handler
  const handleVerifyOTP = async () => {
    // dev-mode success
    login({ id: 'demo-user', email: tempEmail }); // mock user object
    setStep('dashboard');
  };

  // File upload handler
  const handleFileUpload = async (file: File) => {
    // For dev-mode, we mock file upload
    const fileUrl = URL.createObjectURL(file); // show local preview
    const tests = ['CBC', 'CRP', 'Blood Sugar']; // dummy tests
    return { fileUrl, tests };
  };

  // Resend OTP (dev-mode)
  const handleResendOTP = async () => {
    alert('Resend disabled in dev-mode — use 123456');
  };

  if (step === 'otp') {
    return (
      <>
        <OTPVerification
          email={tempEmail}
          onVerify={handleVerifyOTP}
          onResend={handleResendOTP}
        />
        {displayedOtp && (
          <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg">
            <p className="text-sm font-medium">Dev OTP: {displayedOtp}</p>
          </div>
        )}
      </>
    );
  }

  if (step === 'dashboard' && user) {
    return <Dashboard onFileUpload={handleFileUpload} />;
  }

  return <LoginPage onLoginSubmit={handleLogin} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
