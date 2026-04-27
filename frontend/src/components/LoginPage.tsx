import { useState } from 'react';
import { Mail, Lock, ArrowRight, Activity, Shield, BarChart3, Zap } from 'lucide-react';

interface LoginPageProps {
  onLoginSubmit: (email: string, password: string) => Promise<void>;
}

const FEATURES = [
  { icon: Shield, text: 'Private & encrypted report storage' },
  { icon: BarChart3, text: 'Trend analysis across multiple reports' },
  { icon: Zap, text: 'Smart medical test interpretation' },
];

export default function LoginPage({ onLoginSubmit }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required'); return; }
    setLoading(true);
    setError('');
    try {
      await onLoginSubmit(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand identity */}
      <div className="hidden lg:flex w-[52%] bg-navy-800 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full -translate-x-24 translate-y-24 blur-3xl" />
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full -translate-x-16 -translate-y-16 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-white font-semibold text-lg tracking-wide">XMR</div>
            <div className="text-white/40 text-xs">Explain My Report</div>
          </div>
        </div>

        <div className="relative space-y-6">
          <div>
            <h1 className="text-4xl font-semibold text-white leading-snug">
              Your health data,<br />
              <span className="text-cyan-400">clearly understood.</span>
            </h1>
            <p className="mt-4 text-white/60 text-base leading-relaxed max-w-sm">
              Upload medical reports, extract lab results automatically, and track your health markers over time with personalized insights.
            </p>
          </div>

          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <span className="text-white/70 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <p className="text-white/25 text-xs">For informational purposes only. Not a substitute for professional medical advice.</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-navy-800 font-semibold">XMR</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900">Sign in</h2>
            <p className="text-slate-500 text-sm mt-1.5">Enter your email to access your health reports.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input pl-9"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="input pl-9"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            New to XMR? Just enter your email — your account is created automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
