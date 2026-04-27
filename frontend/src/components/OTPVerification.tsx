import { useState, useRef, useEffect } from 'react';
import { ShieldCheck, Mail, Activity } from 'lucide-react';
import { backendUrl, readJsonResponse } from '../utils/api';

interface User { id: string; email: string; }

interface OTPVerificationProps {
  email: string;
  onVerify: (user: User) => void;
  onResend?: () => Promise<void>;
}

export default function OTPVerification({ email, onVerify, onResend }: OTPVerificationProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError('');
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pasted)) return;
    const newOtp = [...otp];
    pasted.split('').forEach((c, i) => { if (i < 6) newOtp[i] = c; });
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length !== 6) { setError('Please enter all 6 digits'); return; }
    setLoading(true);
    setError('');
    try {
      if (otpString === '123456') {
        onVerify({ id: '550e8400-e29b-41d4-a716-446655440000', email });
        return;
      }
      const response = await fetch(`${backendUrl}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpString }),
      });
      const result = await readJsonResponse<any>(response);
      if (!response.ok) throw new Error(result?.error || 'Failed to verify OTP');
      if (result.success && result.user) onVerify(result.user);
      else throw new Error('Verification failed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    if (onResend) {
      try { await onResend(); } catch { setError('Failed to resend OTP.'); }
    }
    setResending(false);
    setOtp(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-navy-800 font-semibold">XMR</span>
        </div>

        <div className="card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-cyan-50 border border-cyan-200 flex items-center justify-center mx-auto mb-5">
            <ShieldCheck className="w-7 h-7 text-cyan-600" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-1">Verify your email</h1>
          <p className="text-sm text-slate-500 mb-1">We sent a 6-digit code to</p>
          <p className="text-sm font-medium text-slate-700 flex items-center justify-center gap-1.5 mb-6">
            <Mail className="w-3.5 h-3.5 text-slate-400" /> {email}
          </p>

          <form onSubmit={handleSubmit}>
            <div className="flex gap-2 justify-center mb-4">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => (inputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  disabled={loading}
                  className={`w-11 h-13 text-center text-xl font-bold border-2 rounded-lg transition
                    focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10
                    ${digit ? 'border-navy-800 bg-navy-50' : 'border-slate-200 bg-white'}
                    disabled:opacity-50`}
                  style={{ height: '3.25rem' }}
                />
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otp.some(d => !d)}
              className="btn-primary w-full justify-center py-3 mb-4"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying…</>
              ) : 'Verify & Continue'}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={resending || loading}
              className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              {resending ? 'Sending…' : "Didn't receive the code? Resend"}
            </button>
          </form>

          <p className="text-xs text-slate-400 mt-4">Dev mode: use code <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">123456</code></p>
        </div>
      </div>
    </div>
  );
}
