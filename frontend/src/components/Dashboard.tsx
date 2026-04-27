import { useState } from 'react';
import { Upload, FileText, Image as ImageIcon, LogOut, Loader2, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Report from './Report';
import VoiceAgent from './VoiceAgent';

interface Patient {
  name: string | null;
  age: number | null;
  gender: string | null;
}

interface Test {
  test_name: string;
  value: string;
  unit: string | null;
  reference_range: string | null;
  interpretation: "Low" | "Normal" | "High" | "Unknown";
  explanation: string;
  health_summary?: string;
  concerning_findings?: string[];
  dietary_recommendations?: string[];
  lifestyle_recommendations?: string[];
}

interface DashboardProps {
  onFileUpload: (file: File) => Promise<{ fileUrl: string; originalFileUrl: string; patient: Patient; tests: Test[] }>;
  onGoToReports: () => void;
  onGoToGoogleVision?: () => void;
}

export default function Dashboard({ onFileUpload, onGoToReports, onGoToGoogleVision }: DashboardProps) {
  const { user, logout } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ url: string; originalUrl: string; type: string } | null>(null);
  const [patientInfo, setPatientInfo] = useState<Patient | null>(null);
  const [extractedTests, setExtractedTests] = useState<Test[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fastMode, setFastMode] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<'none' | 'basic' | 'detailed'>('none');
  const [basicAnalysis] = useState<Test[]>([]);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ url: string; originalUrl: string; type: string; name: string }>>([]);
  const [individualResults, setIndividualResults] = useState<Array<{
    filename: string; fileType: string; fileUrl: string; patient: Patient | null; tests: Test[];
  }>>([]);

  // Debug logging
  console.log('🖥️ Dashboard render:', {
    uploadedFile: !!uploadedFile,
    extractedTestsCount: extractedTests.length,
    analysisPhase,
    analysisResult: !!analysisResult,
    error: !!error,
    user: !!user
  });

  // Debug analysis result structure
  if (analysisResult) {
    console.log('📊 Analysis result structure:', {
      hasTestsByDate: !!analysisResult.tests_by_date,
      hasDateOrder: !!analysisResult.date_order,
      testsByDateKeys: analysisResult.tests_by_date ? Object.keys(analysisResult.tests_by_date) : [],
      dateOrder: analysisResult.date_order
    });
  }

  // Sort tests by interpretation priority: Abnormal (High/Low) -> Normal -> Unknown
  const sortedTests = [...extractedTests].sort((a, b) => {
    const priority = { 'High': 4, 'Low': 4, 'Normal': 2, 'Unknown': 1 };
    return priority[b.interpretation] - priority[a.interpretation];
  });

  const uploadSingleFile = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    if (user?.profile) {
      formData.append('user_profile', JSON.stringify(user.profile));
    }
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/upload${fastMode ? '?fast=true' : ''}`,
      { method: 'POST', body: formData }
    );
    if (!response.ok) throw new Error(`Upload failed for ${file.name}`);
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result;
  };

  const mergeResults = (results: any[], files: File[]) => {
    const allTests: Test[] = [];
    const mergedByDate: Record<string, Test[]> = {};
    const dateSet = new Set<string>();
    let patient = null;
    let firstFileUrl = '';
    let firstFileType = '';
    let firstDisplayUrl = '';

    results.forEach((result, i) => {
      const file = files[i];
      const backendUrl = result.fileUrl || '';
      const displayUrl = backendUrl.startsWith('http://localhost') || backendUrl.startsWith('blob:')
        ? URL.createObjectURL(file)
        : backendUrl;

      if (i === 0) {
        patient = result.patient;
        firstFileUrl = backendUrl;
        firstFileType = file.type;
        firstDisplayUrl = displayUrl;
      }

      const tests: Test[] = result.tests || [];
      allTests.push(...tests);

      const byDate: Record<string, Test[]> = result.tests_by_date || {};
      const order: string[] = result.date_order || [];
      order.forEach(date => {
        dateSet.add(date);
        mergedByDate[date] = [...(mergedByDate[date] || []), ...(byDate[date] || [])];
      });

      // If no date grouping, bucket under file name as date label
      if (order.length === 0 && tests.length > 0) {
        const label = file.name.replace(/\.[^.]+$/, '');
        dateSet.add(label);
        mergedByDate[label] = [...(mergedByDate[label] || []), ...tests];
      }
    });

    const dateOrder = Array.from(dateSet);

    return {
      patient,
      tests: allTests,
      tests_by_date: mergedByDate,
      date_order: dateOrder,
      analysis_complete: true,
      fileUrl: firstFileUrl,
      displayUrl: firstDisplayUrl,
      fileType: firstFileType,
    };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const invalid = files.find(f => !validTypes.includes(f.type));
    if (invalid) {
      setError(`${invalid.name}: only PDF, PNG, JPG files are supported`);
      return;
    }

    setUploading(true);
    setError('');
    setSaved(false);

    const results: any[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isPDF = file.type === 'application/pdf';
        const prefix = files.length > 1 ? `File ${i + 1}/${files.length}: ` : '';
        const steps = isPDF
          ? ['Uploading...', 'Extracting text...', 'Analyzing results...', 'Generating insights...']
          : ['Uploading...', 'Running OCR...', 'Analyzing results...', 'Generating insights...'];

        let stepIndex = 0;
        setUploadStatus(`${prefix}${steps[0]}`);
        const timer = setInterval(() => {
          stepIndex = Math.min(stepIndex + 1, steps.length - 1);
          setUploadStatus(`${prefix}${steps[stepIndex]}`);
        }, 3000);

        try {
          const result = await uploadSingleFile(file);
          results.push(result);
        } finally {
          clearInterval(timer);
        }
      }

      // Store each file's result individually for saving
      setIndividualResults(results.map((result, i) => {
        const file = files[i];
        const backendUrl = result.fileUrl || '';
        return {
          filename: file.name,
          fileType: file.type,
          fileUrl: backendUrl,
          patient: result.patient,
          tests: result.tests || [],
        };
      }));

      // Store all uploaded files for multi-file preview
      setUploadedFiles(results.map((result, i) => {
        const file = files[i];
        const backendUrl = result.fileUrl || '';
        const displayUrl = backendUrl.startsWith('http://localhost') || backendUrl.startsWith('blob:')
          ? URL.createObjectURL(file)
          : backendUrl;
        return { url: displayUrl, originalUrl: backendUrl, type: file.type, name: file.name };
      }));

      const merged = mergeResults(results, files);
      setAnalysisResult(merged);
      setUploadedFile({ url: merged.displayUrl, originalUrl: merged.fileUrl, type: merged.fileType });
      setPatientInfo(merged.patient);
      setExtractedTests(merged.tests);
      setAnalysisPhase('detailed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  };

  const handleSaveReport = async () => {
    if (!user || !uploadedFile || !patientInfo || extractedTests.length === 0) return;

    setSaving(true);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;

      // Save each file as a separate report
      const toSave = individualResults.length > 0 ? individualResults : [{
        filename: uploadedFile.originalUrl.split('/').pop() || 'report',
        fileType: uploadedFile.type,
        fileUrl: uploadedFile.originalUrl,
        patient: patientInfo,
        tests: extractedTests,
      }];

      const saveResults = await Promise.all(toSave.map(r =>
        fetch(`${backendUrl}/save-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            filename: r.filename,
            fileType: r.fileType,
            fileUrl: r.fileUrl,
            patient: r.patient,
            tests: r.tests,
          }),
        }).then(res => res.json())
      ));

      const failed = saveResults.find(r => !r.success);
      if (!failed) {
        setSaved(true);
      } else {
        setError(failed.error || 'Failed to save one or more reports');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Medical Report Analyzer</h1>
            <p className="text-sm text-gray-600 mt-1">
              Welcome{user?.profile?.name ? `, ${user.profile.name}` : user?.email ? `, ${user.email}` : ''}!
            </p>
            {user?.profile && (
              <div className="text-xs text-gray-500 mt-1">
                Age: {user.profile.age} • {user.profile.bodyType} • Goal: {user.profile.currentGoal}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onGoToReports}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
            >
              <BarChart3 className="w-4 h-4" />
              My Reports
            </button>
            {onGoToGoogleVision && (
              <button
                onClick={onGoToGoogleVision}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
              >
                🤖 Vision OCR
              </button>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!uploadedFile ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
                <Upload className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Upload Your Report</h2>
              <p className="text-gray-600 mb-6">
                Upload a medical report (PDF or image) to extract and analyze test results
              </p>

              {/* Fast Mode Toggle */}
            

              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  multiple
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="hidden"
                />
                <div className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-xl transition duration-200 inline-flex items-center gap-3 disabled:opacity-50">
                  {uploading ? (
                    <>
                      <Loader2 className="animate-spin w-6 h-6" />
                      <span>{uploadStatus || 'Analyzing your report...'}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6" />
                      <span>Choose File</span>
                    </>
                  )}
                </div>
              </label>

              {error && (
                <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="mt-8 text-sm text-gray-500">
                <p className="font-medium mb-2">Supported formats:</p>
                <div className="flex justify-center gap-4">
                  <span className="flex items-center gap-1">
                    <FileText className="w-4 h-4" /> PDF
                  </span>
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-4 h-4" /> PNG, JPG, JPEG
                  </span>
                </div>
              </div>
            </div>

            {/* Personalized Health Insights */}
            {user?.profile && (
              <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Your Health Journey</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h4 className="font-semibold text-gray-900 mb-2">Your Profile</h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <p><strong>Age:</strong> {user.profile.age} years</p>
                      <p><strong>Height:</strong> {user.profile.height} cm</p>
                      <p><strong>Weight:</strong> {user.profile.weight} kg</p>
                      <p><strong>Body Type:</strong> {user.profile.bodyType}</p>
                      {user.profile.previousDiseases && (
                        <p><strong>Medical History:</strong> {user.profile.previousDiseases}</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h4 className="font-semibold text-gray-900 mb-2">Your BMI</h4>
                    {user.profile.height && user.profile.weight ? (() => {
                      const heightM = parseFloat(user.profile.height) / 100;
                      const weightKg = parseFloat(user.profile.weight);
                      const bmi = (weightKg / (heightM * heightM)).toFixed(1);
                      let bmiCategory = '';
                      let bmiColor = '';

                      if (parseFloat(bmi) < 18.5) {
                        bmiCategory = 'Underweight';
                        bmiColor = 'text-blue-600';
                      } else if (parseFloat(bmi) < 25) {
                        bmiCategory = 'Normal';
                        bmiColor = 'text-green-600';
                      } else if (parseFloat(bmi) < 30) {
                        bmiCategory = 'Overweight';
                        bmiColor = 'text-yellow-600';
                      } else {
                        bmiCategory = 'Obese';
                        bmiColor = 'text-red-600';
                      }

                      return (
                        <div className="space-y-2">
                          <p className="text-3xl font-bold text-gray-900">{bmi}</p>
                          <p className={`text-sm font-medium ${bmiColor}`}>{bmiCategory}</p>
                          <p className="text-xs text-gray-500">Body Mass Index</p>
                        </div>
                      );
                    })() : (
                      <p className="text-sm text-gray-500">Complete height and weight to see BMI</p>
                    )}
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h4 className="font-semibold text-gray-900 mb-2">Your Goal</h4>
                    <p className="text-sm text-gray-600 mb-3">{user.profile.currentGoal}</p>
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-1">Your Vision</p>
                      <p className="text-sm text-gray-600">{user.profile.desiredOutcome}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Voice Agent - Available before uploading */}
            <VoiceAgent
              patientInfo={null}
              extractedTests={[]}
              userId={user?.id}
              userProfile={user?.profile}
            />
          </div>
        ) : (
          <Report
            extractedTests={extractedTests}
            patientInfo={patientInfo}
            uploadedFile={uploadedFile}
            uploadedFiles={uploadedFiles}
            analysisPhase={analysisPhase}
            basicAnalysis={basicAnalysis}
            analysisResult={analysisResult}
            onFileSelect={handleFileSelect}
            uploading={uploading}
            handleSaveReport={handleSaveReport}
            saving={saving}
            saved={saved}
            userId={user?.id}
            userProfile={user?.profile}
          />
        )}
      </main>
    </div>
  );
}