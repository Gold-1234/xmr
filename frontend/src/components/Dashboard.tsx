import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, ImageIcon, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Report from './Report';
import { backendUrl, readJsonResponse } from '../utils/api';

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
  interpretation: 'Low' | 'Normal' | 'High' | 'Unknown';
  explanation: string;
  health_summary?: string;
  concerning_findings?: string[];
  dietary_recommendations?: string[];
  lifestyle_recommendations?: string[];
}

function getBMI(h: string, w: string) {
  const hm = parseFloat(h) / 100;
  const wk = parseFloat(w);
  if (!hm || !wk) return null;
  const bmi = wk / (hm * hm);
  let cat = 'Normal', color = 'text-emerald-600', bg = 'bg-emerald-50 border-emerald-200';
  if (bmi < 18.5) { cat = 'Underweight'; color = 'text-sky-600'; bg = 'bg-sky-50 border-sky-200'; }
  else if (bmi >= 25 && bmi < 30) { cat = 'Overweight'; color = 'text-amber-600'; bg = 'bg-amber-50 border-amber-200'; }
  else if (bmi >= 30) { cat = 'Obese'; color = 'text-red-600'; bg = 'bg-red-50 border-red-200'; }
  return { value: bmi.toFixed(1), cat, color, bg };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; originalUrl: string; type: string } | null>(null);
  const [patientInfo, setPatientInfo] = useState<Patient | null>(null);
  const [extractedTests, setExtractedTests] = useState<Test[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<'none' | 'basic' | 'detailed'>('none');
  const [basicAnalysis, setBasicAnalysis] = useState<Test[]>([]);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save as soon as analysis is fully complete
  useEffect(() => {
    if (analysisPhase === 'detailed' && uploadedFile && extractedTests.length > 0 && !saved && !saving) {
      handleSaveReport();
    }
  }, [analysisPhase, uploadedFile, extractedTests]);

  const profile = user?.profile;
  const bmi = profile ? getBMI(profile.height, profile.weight) : null;
  const displayName = profile?.name || user?.email?.split('@')[0] || 'there';

  const processFile = async (file: File) => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF, PNG, JPG, or JPEG file');
      return;
    }

    setUploading(true);
    setError('');
    setSaved(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (user?.profile) formData.append('user_profile', JSON.stringify(user.profile));

      const response = await fetch(`${backendUrl}/upload`, { method: 'POST', body: formData });
      const result = await readJsonResponse<any>(response);

      if (!response.ok || result.error) throw new Error(result?.error || `Upload failed (${response.status})`);

      const backendFileUrl = result.fileUrl;
      let displayUrl = backendFileUrl;
      if (backendFileUrl.startsWith('http://localhost') || backendFileUrl.startsWith('blob:')) {
        displayUrl = URL.createObjectURL(file);
      }

      setAnalysisResult(result);

      if (result.basic_analysis && result.detailed_analysis) {
        setBasicAnalysis(result.basic_analysis.tests || []);
        setAnalysisPhase('basic');
        setUploadedFile({ url: displayUrl, originalUrl: backendFileUrl, type: file.type });
        setPatientInfo(result.basic_analysis.patient);
        setExtractedTests(result.basic_analysis.tests || []);

        setTimeout(() => {
          setExtractedTests(result.detailed_analysis.tests || result.basic_analysis.tests || []);
          setPatientInfo(result.detailed_analysis.patient || result.basic_analysis.patient);
          setAnalysisPhase('detailed');
        }, 2000);
      } else {
        setUploadedFile({ url: displayUrl, originalUrl: backendFileUrl, type: file.type });
        setPatientInfo(result.patient);
        setExtractedTests(result.tests || []);
        setAnalysisPhase('detailed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  };

  const handleSaveReport = async () => {
    if (!user || !uploadedFile || !patientInfo || extractedTests.length === 0) return;
    setSaving(true);
    try {
      const response = await fetch(`${backendUrl}/save-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          filename: uploadedFile.originalUrl.split('/').pop() || 'report',
          fileType: uploadedFile.type,
          fileUrl: uploadedFile.originalUrl,
          patient: patientInfo,
          tests: extractedTests,
        }),
      });
      const result = await readJsonResponse<any>(response);
      if (result.success) setSaved(true);
      else setError(result.error || 'Failed to save report');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  if (uploadedFile) {
    return (
      <div className="p-6 lg:p-8">
        <Report
          extractedTests={extractedTests}
          patientInfo={patientInfo}
          uploadedFile={uploadedFile}
          analysisPhase={analysisPhase}
          basicAnalysis={basicAnalysis}
          analysisResult={analysisResult}
          onNewUpload={() => {
            setUploadedFile(null);
            setExtractedTests([]);
            setPatientInfo(null);
            setAnalysisResult(null);
            setAnalysisPhase('none');
            setSaved(false);
          }}
          uploading={uploading}
          handleSaveReport={handleSaveReport}
          saving={saving}
          saved={saved}
        />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Hello, {displayName}</h1>
        <p className="text-slate-500 mt-1 text-sm">Upload a medical report to get started with your analysis.</p>
      </div>

      {/* Profile stats */}
      {profile && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="card p-4">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Age</div>
            <div className="text-xl font-semibold text-slate-900">{profile.age}</div>
            <div className="text-xs text-slate-500">years</div>
          </div>
          {bmi && (
            <div className={`card p-4 border ${bmi.bg}`}>
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">BMI</div>
              <div className={`text-xl font-semibold ${bmi.color}`}>{bmi.value}</div>
              <div className="text-xs text-slate-500">{bmi.cat}</div>
            </div>
          )}
          {profile.height && (
            <div className="card p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Height</div>
              <div className="text-xl font-semibold text-slate-900">{profile.height}</div>
              <div className="text-xs text-slate-500">cm</div>
            </div>
          )}
          {profile.weight && (
            <div className="card p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Weight</div>
              <div className="text-xl font-semibold text-slate-900">{profile.weight}</div>
              <div className="text-xs text-slate-500">kg</div>
            </div>
          )}
        </div>
      )}

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-150 cursor-pointer
          ${dragging ? 'border-cyan-500 bg-cyan-50' : 'border-slate-300 hover:border-slate-400 bg-white'}
          ${uploading ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleFileInput}
          disabled={uploading}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors
            ${dragging ? 'bg-cyan-100' : 'bg-slate-100'}`}>
            {uploading ? (
              <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
            ) : (
              <Upload className={`w-8 h-8 ${dragging ? 'text-cyan-600' : 'text-slate-400'}`} />
            )}
          </div>

          <div>
            {uploading ? (
              <>
                <p className="text-base font-medium text-slate-700">Analyzing your report…</p>
                <p className="text-sm text-slate-400 mt-1">This may take 30–60 seconds for detailed analysis</p>
              </>
            ) : (
              <>
                <p className="text-base font-medium text-slate-700">
                  {dragging ? 'Drop your file here' : 'Drop your file here, or click to browse'}
                </p>
                <p className="text-sm text-slate-400 mt-1">Supports PDF, PNG, JPG, JPEG</p>
              </>
            )}
          </div>

          {!uploading && (
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> PDF
              </span>
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> PNG / JPG
              </span>
            </div>
          )}
        </div>

        {uploading && (
          <div className="mt-6 max-w-xs mx-auto">
            <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 rounded-full animate-[progress_2s_ease-in-out_infinite]"
                style={{ width: '60%', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* What we analyze section */}
      {!uploading && (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: '🧪', title: 'Lab Results', desc: 'Automatic extraction of test names, values, units, and reference ranges.' },
            { icon: '🧠', title: 'Health Insights', desc: 'Personalized interpretation based on your age, weight, and health goals.' },
            { icon: '📈', title: 'Trend Tracking', desc: 'Track how your key markers change over multiple reports over time.' },
          ].map(item => (
            <div key={item.title} className="card p-5">
              <div className="text-2xl mb-3">{item.icon}</div>
              <div className="text-sm font-semibold text-slate-800 mb-1">{item.title}</div>
              <div className="text-xs text-slate-500 leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      )}

      {profile?.currentGoal && (
        <div className="mt-6 card p-5 flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-slate-700">Your goal</div>
            <div className="text-sm text-slate-500 mt-0.5">{profile.currentGoal}</div>
          </div>
        </div>
      )}
    </div>
  );
}
