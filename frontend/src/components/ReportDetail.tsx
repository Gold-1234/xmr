import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, ImageIcon, Calendar, User, TrendingUp, ChevronDown, ChevronUp, Mic } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { backendUrl, readJsonResponse } from '../utils/api';
import { getStatusClass } from '../utils/trendUtils';
import VoiceAgent from './VoiceAgent';

interface Test {
  test_name: string;
  value: string;
  unit: string | null;
  reference_range: string | null;
  interpretation: 'Low' | 'Normal' | 'High' | 'Unknown';
  explanation: string;
}

interface Report {
  id: string;
  filename: string;
  file_type: string;
  file_url: string;
  extracted_tests: string[];
  patient_name: string | null;
  patient_age: number | null;
  patient_gender: string | null;
  created_at: string;
  test_results: Test[];
}

interface ReportDetailProps {
  reportId: string;
  onBack: () => void;
  onViewTrends?: (testName: string) => void;
}

function TestRow({ test, onTrend }: { test: Test; onTrend?: (n: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50"
        onClick={() => setOpen(o => !o)}
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-900 truncate">{test.test_name}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            <span className="font-semibold text-slate-700">{test.value}</span>
            {test.unit && <span className="ml-1">{test.unit}</span>}
            {test.reference_range && <span className="ml-2 text-slate-400">Ref: {test.reference_range}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onTrend && (
            <button
              onClick={e => { e.stopPropagation(); onTrend(test.test_name); }}
              className="p-1 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded transition-colors"
              title="View trend"
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
          )}
          <span className={getStatusClass(test.interpretation)}>{test.interpretation}</span>
          {test.explanation && (open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />)}
        </div>
      </div>
      {open && test.explanation && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
          <p className="text-xs text-slate-600 leading-relaxed">{test.explanation}</p>
        </div>
      )}
    </div>
  );
}

export default function ReportDetail({ reportId, onBack, onViewTrends }: ReportDetailProps) {
  const { user } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [textContent, setTextContent] = useState('');
  const [showVoice, setShowVoice] = useState(false);

  useEffect(() => { loadReportDetail(); }, [reportId]);
  useEffect(() => {
    if (report && report.file_type.startsWith('text/')) fetchTextContent();
  }, [report]);

  const getImageUrl = (url: string) =>
    url.startsWith('https://res.cloudinary.com/')
      ? `${backendUrl}/proxy-image?url=${encodeURIComponent(url)}`
      : url;

  const fetchTextContent = async () => {
    if (!report) return;
    try {
      const res = await fetch(getImageUrl(report.file_url));
      setTextContent(res.ok ? await res.text() : 'Could not load text content');
    } catch { setTextContent('Could not load text content'); }
  };

  const loadReportDetail = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${backendUrl}/report/${reportId}`);
      const data = await readJsonResponse<any>(response);
      if (response.ok) setReport(data);
      else setError(data.error ?? 'Failed to load report');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const sortedTests = report?.test_results
    ? [...report.test_results].sort((a, b) => {
        const p: Record<string, number> = { High: 4, Low: 3, Normal: 2, Unknown: 1 };
        return (p[b.interpretation] ?? 0) - (p[a.interpretation] ?? 0);
      })
    : [];

  const formatDate = (ds: string) =>
    new Date(ds).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy-800 border-t-transparent mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading report…</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-6 lg:p-8">
        <button onClick={onBack} className="btn-ghost mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Reports
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error || 'Report not found'}
        </div>
      </div>
    );
  }

  const isPDF = report.file_type === 'application/pdf';
  const isImage = report.file_type.startsWith('image/');
  const isText = report.file_type.startsWith('text/');

  const abnormal = sortedTests.filter(t => t.interpretation === 'High' || t.interpretation === 'Low').length;
  const normal = sortedTests.filter(t => t.interpretation === 'Normal').length;

  const patientInfo = report ? {
    name: report.patient_name,
    age: report.patient_age,
    gender: report.patient_gender,
  } : null;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="btn-ghost">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="page-title truncate max-w-xs sm:max-w-none">{report.filename}</h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
              <Calendar className="w-3 h-3" />
              {formatDate(report.created_at)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {abnormal > 0 && <span className="badge-high">{abnormal} abnormal</span>}
          {normal > 0 && <span className="badge-normal">{normal} normal</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: document + voice assistant */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="section-title flex items-center gap-2 mb-4">
              {isPDF || isText ? <FileText className="w-4 h-4 text-slate-400" /> : <ImageIcon className="w-4 h-4 text-slate-400" />}
              Original Document
            </h2>
            <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
              {isPDF && <embed src={report.file_url} type="application/pdf" className="w-full h-[550px]" />}
              {isImage && (
                <img
                  src={getImageUrl(report.file_url)}
                  alt="Medical Report"
                  className="w-full max-h-[550px] object-contain"
                />
              )}
              {isText && (
                <pre className="whitespace-pre-wrap text-xs p-4 overflow-auto max-h-[550px] font-mono text-slate-700">
                  {textContent || 'Loading…'}
                </pre>
              )}
            </div>
          </div>

          {/* Voice Assistant card */}
          {sortedTests.length > 0 && !showVoice && (
            <div className="card p-5 border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center flex-shrink-0">
                  <Mic className="w-4 h-4 text-cyan-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Voice Assistant</div>
                  <div className="text-xs text-slate-500 mt-0.5">Ask questions about your report using your voice</div>
                </div>
              </div>
              <button
                onClick={() => setShowVoice(true)}
                className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 active:scale-[0.98] text-white text-sm font-medium py-2.5 rounded-lg transition-all"
              >
                <Mic className="w-4 h-4" />
                Start Voice Session
              </button>
              <div className="mt-3 flex items-center justify-center gap-3 text-xs text-slate-400">
                <span>Real-time responses</span>
                <span>·</span>
                <span>Report-aware</span>
                <span>·</span>
                <span>Multilingual</span>
              </div>
            </div>
          )}

          {/* Expanded Voice Assistant */}
          {showVoice && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                  <span className="text-sm font-semibold text-slate-900">Voice Assistant</span>
                </div>
                <button onClick={() => setShowVoice(false)} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                  Close
                </button>
              </div>
              <VoiceAgent patientInfo={patientInfo} extractedTests={sortedTests} />
            </div>
          )}
        </div>

        {/* Right: analysis */}
        <div className="space-y-5">
          {(report.patient_name || report.patient_age || report.patient_gender) && (
            <div className="card p-5">
              <h3 className="section-title flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-slate-400" />
                Patient Information
              </h3>
              <div className="flex flex-wrap gap-3">
                {report.patient_name && (
                  <div className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-400 mb-0.5">Name</div>
                    <div className="text-sm font-semibold text-slate-900">{report.patient_name}</div>
                  </div>
                )}
                {report.patient_age && (
                  <div className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-400 mb-0.5">Age</div>
                    <div className="text-sm font-semibold text-slate-900">{report.patient_age} yrs</div>
                  </div>
                )}
                {report.patient_gender && (
                  <div className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-400 mb-0.5">Gender</div>
                    <div className="text-sm font-semibold text-slate-900">{report.patient_gender}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card p-5">
            <h3 className="section-title mb-4">
              Test Results <span className="font-normal text-slate-400">({sortedTests.length})</span>
            </h3>
            <div className="space-y-2 max-h-[450px] overflow-y-auto scrollbar-thin pr-1">
              {sortedTests.map((test, i) => (
                <TestRow key={i} test={test} onTrend={onViewTrends} />
              ))}
              {sortedTests.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">No test results found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
