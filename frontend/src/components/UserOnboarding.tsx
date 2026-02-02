import { useState } from 'react';
import { User, Target, Heart, ChevronRight, ChevronLeft } from 'lucide-react';

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

const bodyTypes = [
  { value: 'athletic', label: 'Athletic', description: 'Active lifestyle, regular exercise' },
  { value: 'lean', label: 'Lean', description: 'Slim build, low body fat' },
  { value: 'muscular', label: 'Muscular', description: 'Well-built, strength training' },
  { value: 'healthy', label: 'Healthy', description: 'Balanced weight, moderate activity' },
  { value: 'obese', label: 'Obese', description: 'Higher weight, need support' },
];

export default function UserOnboarding({ onComplete }: UserOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    age: '',
    height: '',
    weight: '',
    previousDiseases: '',
    bodyType: '',
    currentGoal: '',
    desiredOutcome: '',
  });

  const steps = [
    { title: 'Personal Info', icon: User },
    { title: 'Medical History', icon: Heart },
    { title: 'Body Type', icon: Target },
    { title: 'Goals', icon: Target },
  ];

  const updateProfile = (field: keyof UserProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete(profile);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return profile.name.trim() && profile.age.trim();
      case 1: return true; // Medical history is optional
      case 2: return profile.bodyType !== '';
      case 3: return profile.currentGoal.trim() && profile.desiredOutcome.trim();
      default: return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <User className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Tell us about yourself</h2>
              <p className="text-gray-600">Let's start with some basic information</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => updateProfile('name', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your full name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Age
                  </label>
                  <input
                    type="number"
                    value={profile.age}
                    onChange={(e) => updateProfile('age', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Age"
                    min="1"
                    max="120"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    value={profile.height}
                    onChange={(e) => updateProfile('height', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Height in cm"
                    min="50"
                    max="250"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={profile.weight}
                    onChange={(e) => updateProfile('weight', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Weight in kg"
                    min="20"
                    max="300"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Heart className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Medical History</h2>
              <p className="text-gray-600">Help us understand your health background</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Previous Diseases or Conditions
              </label>
              <textarea
                value={profile.previousDiseases}
                onChange={(e) => updateProfile('previousDiseases', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="List any previous diseases, conditions, or surgeries (optional)"
                rows={4}
              />
              <p className="text-sm text-gray-500 mt-2">Leave blank if none</p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Target className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Body Type</h2>
              <p className="text-gray-600">Select the option that best describes you</p>
            </div>

            <div className="grid gap-3">
              {bodyTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => updateProfile('bodyType', type.value)}
                  className={`p-4 border rounded-lg text-left transition ${
                    profile.bodyType === type.value
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">{type.label}</div>
                  <div className="text-sm text-gray-600">{type.description}</div>
                </button>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Target className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Goals</h2>
              <p className="text-gray-600">What do you want to achieve?</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Health Goal
                </label>
                <textarea
                  value={profile.currentGoal}
                  onChange={(e) => updateProfile('currentGoal', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Lose weight, build muscle, improve fitness, manage diabetes..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What do you want to become?
                </label>
                <textarea
                  value={profile.desiredOutcome}
                  onChange={(e) => updateProfile('desiredOutcome', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., More energetic, healthier, fitter version of myself..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  index <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  <step.icon className="w-4 h-4" />
                </div>
                <span className={`text-xs mt-1 ${
                  index <= currentStep ? 'text-blue-600 font-medium' : 'text-gray-400'
                }`}>
                  {step.title}
                </span>
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-8">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </button>

          <button
            onClick={nextStep}
            disabled={!canProceed()}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentStep === steps.length - 1 ? 'Complete Setup' : 'Next'}
            <ChevronRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}