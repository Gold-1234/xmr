import { useState } from 'react';
import { ChevronRight, ChevronLeft, Activity, User, Heart, Target, CheckCircle } from 'lucide-react';

interface UserProfile {
  name: string;
  age: string;
  height: string;
  weight: string;
  previousDiseases: string;
  bodyType: 'athletic' | 'lean' | 'muscular' | 'healthy' | 'obese' | '';
  currentGoal: string;
  desiredOutcome: string;
}

interface UserOnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

const BODY_TYPES = [
  { value: 'athletic', label: 'Athletic', icon: '🏃', desc: 'Regular exercise, active lifestyle' },
  { value: 'lean', label: 'Lean', icon: '💨', desc: 'Naturally slim build' },
  { value: 'muscular', label: 'Muscular', icon: '💪', desc: 'Strong, well-built physique' },
  { value: 'healthy', label: 'Average', icon: '🙂', desc: 'Moderate activity level' },
  { value: 'obese', label: 'Overweight', icon: '⚖️', desc: 'Working toward healthy weight' },
] as const;

const STEPS = [
  { id: 1, title: 'Personal Info', icon: User, description: 'Basic details for personalized analysis' },
  { id: 2, title: 'Medical History', icon: Heart, description: 'Help us understand your health background' },
  { id: 3, title: 'Body & Goals', icon: Target, description: 'Your current physique and health goals' },
];

export default function UserOnboarding({ onComplete }: UserOnboardingProps) {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<UserProfile>({
    name: '', age: '', height: '', weight: '',
    previousDiseases: '', bodyType: '', currentGoal: '', desiredOutcome: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: keyof UserProfile, value: string) => {
    setProfile(p => ({ ...p, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (step === 1) {
      if (!profile.name.trim()) errs.name = 'Name is required';
      if (!profile.age || isNaN(Number(profile.age))) errs.age = 'Valid age is required';
    }
    if (step === 3) {
      if (!profile.bodyType) errs.bodyType = 'Please select a body type';
      if (!profile.currentGoal.trim()) errs.currentGoal = 'Please enter your current goal';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (!validate()) return;
    if (step < 3) setStep(s => s + 1);
    else onComplete(profile);
  };

  const back = () => setStep(s => s - 1);

  const progressPct = ((step - 1) / 2) * 100;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-slate-900">XMR</span>
          <div className="flex-1" />
          <span className="text-sm text-slate-400">Step {step} of 3</span>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-slate-200">
          <div
            className="h-full bg-cyan-500 transition-all duration-300"
            style={{ width: `${progressPct + 33}%` }}
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center py-10 px-4">
        <div className="w-full max-w-lg">
          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-8 justify-center">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = step > s.id;
              const active = step === s.id;
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    done ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    active ? 'bg-navy-800 text-white' :
                    'bg-white text-slate-400 border border-slate-200'
                  }`}>
                    {done ? <CheckCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{s.title}</span>
                  </div>
                  {i < 2 && <div className={`w-6 h-px ${step > s.id ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                </div>
              );
            })}
          </div>

          {/* Card */}
          <div className="card p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">{STEPS[step - 1].title}</h2>
              <p className="text-sm text-slate-500 mt-1">{STEPS[step - 1].description}</p>
            </div>

            {/* Step 1: Personal Info */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="label">Full name *</label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder="Your full name"
                    className={`input ${errors.name ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
                    autoFocus
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="label">Age *</label>
                  <input
                    type="number"
                    value={profile.age}
                    onChange={e => update('age', e.target.value)}
                    placeholder="Your age in years"
                    min="1" max="120"
                    className={`input ${errors.age ? 'border-red-300' : ''}`}
                  />
                  {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Height (cm)</label>
                    <input
                      type="number"
                      value={profile.height}
                      onChange={e => update('height', e.target.value)}
                      placeholder="e.g. 175"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Weight (kg)</label>
                    <input
                      type="number"
                      value={profile.weight}
                      onChange={e => update('weight', e.target.value)}
                      placeholder="e.g. 70"
                      className="input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Medical History */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="label">Previous or ongoing medical conditions</label>
                  <textarea
                    value={profile.previousDiseases}
                    onChange={e => update('previousDiseases', e.target.value)}
                    placeholder="e.g. Diabetes, hypertension, thyroid disorder… or leave blank if none"
                    rows={5}
                    className="input resize-none"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">This helps us personalize test interpretations and recommendations.</p>
                </div>

                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    <span className="font-medium text-slate-600">Your privacy matters.</span> This information is stored locally on your device and used only to improve the accuracy of your health report analysis. We never share it with third parties.
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Body Type & Goals */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <label className="label">Body type *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {BODY_TYPES.map(bt => (
                      <button
                        key={bt.value}
                        type="button"
                        onClick={() => update('bodyType', bt.value)}
                        className={`text-left p-3 rounded-lg border-2 transition-all ${
                          profile.bodyType === bt.value
                            ? 'border-navy-800 bg-navy-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="text-lg mb-1">{bt.icon}</div>
                        <div className={`text-xs font-medium ${profile.bodyType === bt.value ? 'text-navy-800' : 'text-slate-700'}`}>{bt.label}</div>
                        <div className="text-xs text-slate-400 mt-0.5 leading-tight">{bt.desc}</div>
                      </button>
                    ))}
                  </div>
                  {errors.bodyType && <p className="text-red-500 text-xs mt-1">{errors.bodyType}</p>}
                </div>

                <div>
                  <label className="label">Current health goal *</label>
                  <input
                    type="text"
                    value={profile.currentGoal}
                    onChange={e => update('currentGoal', e.target.value)}
                    placeholder="e.g. Improve energy, manage cholesterol, build fitness"
                    className={`input ${errors.currentGoal ? 'border-red-300' : ''}`}
                  />
                  {errors.currentGoal && <p className="text-red-500 text-xs mt-1">{errors.currentGoal}</p>}
                </div>

                <div>
                  <label className="label">Desired outcome</label>
                  <textarea
                    value={profile.desiredOutcome}
                    onChange={e => update('desiredOutcome', e.target.value)}
                    placeholder="What does good health look like for you in 6 months?"
                    rows={3}
                    className="input resize-none"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={back}
                disabled={step === 1}
                className={`btn-secondary ${step === 1 ? 'invisible' : ''}`}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              <button
                type="button"
                onClick={next}
                className="btn-primary"
              >
                {step === 3 ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Complete setup
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-4">
            You can update these details later in your profile settings.
          </p>
        </div>
      </div>
    </div>
  );
}
