import React, { useState } from 'react';
import { Loader2, Download, FileText, ImageIcon, Upload, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Salad, Dumbbell, Calendar, Mic } from 'lucide-react';
import { backendUrl, readJsonResponse } from '../utils/api';
import { getStatusClass } from '../utils/trendUtils';
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
  interpretation: 'Low' | 'Normal' | 'High' | 'Unknown';
  explanation?: string;
  health_summary?: string;
  concerning_findings?: string[];
  dietary_recommendations?: string[];
  lifestyle_recommendations?: string[];
}

interface UploadedFile {
  url: string;
  originalUrl: string;
  type: string;
}

interface ReportProps {
  extractedTests: Test[];
  patientInfo: Patient | null;
  uploadedFile: UploadedFile | null;
  analysisPhase: 'none' | 'basic' | 'detailed';
  basicAnalysis: Test[];
  analysisResult: any;
  onNewUpload: () => void;
  uploading: boolean;
  handleSaveReport: () => void;
  saving: boolean;
  saved: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const cls = getStatusClass(status);
  return <span className={cls}>{status}</span>;
}

function TestCard({ test }: { test: Test }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">{test.test_name}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              <span className="font-semibold text-slate-700">{test.value}</span>
              {test.unit && <span className="ml-1">{test.unit}</span>}
              {test.reference_range && <span className="ml-2 text-slate-400">Ref: {test.reference_range}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={test.interpretation} />
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

const Report: React.FC<ReportProps> = ({
  extractedTests, patientInfo, uploadedFile, analysisPhase, analysisResult,
  onNewUpload, uploading, handleSaveReport, saving, saved,
}) => {
  const [showVoice, setShowVoice] = useState(false);
  const isPDF = uploadedFile?.type === 'application/pdf';
  const isImage = uploadedFile?.type.startsWith('image/');
  const summaryData = extractedTests[0] ?? null;
  const testsByDate: Record<string, Test[]> = analysisResult?.tests_by_date ?? {};
  const dateOrder: string[] = analysisResult?.date_order ?? [];
  const hasDateGrouping = dateOrder.length > 0 && Object.keys(testsByDate).length > 0;

  const sortedFlat = [...extractedTests].sort((a, b) => {
    const p: Record<string, number> = { High: 4, Low: 3, Normal: 2, Unknown: 1 };
    return (p[b.interpretation] ?? 0) - (p[a.interpretation] ?? 0);
  });

  const abnormalCount = extractedTests.filter(t => t.interpretation === 'High' || t.interpretation === 'Low').length;
  const normalCount = extractedTests.filter(t => t.interpretation === 'Normal').length;

  const handleDownloadTxt = async () => {
    try {
      const response = await fetch(`${backendUrl}/download-txt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient: patientInfo, tests: extractedTests,
          tests_by_date: analysisResult?.tests_by_date,
          date_order: analysisResult?.date_order,
          analysis_complete: true,
        }),
      });
      const result = await readJsonResponse<any>(response);
      if (result.success && result.txt_url) {
        const a = document.createElement('a');
        a.href = result.txt_url;
        a.download = result.filename || 'medical_report.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Analysis Results</h1>
          {extractedTests.length > 0 && (
            <p className="text-sm text-slate-500 mt-0.5">
              {extractedTests.length} tests found
              {abnormalCount > 0 && <span className="text-amber-600 ml-2">· {abnormalCount} need attention</span>}
              {normalCount > 0 && <span className="text-emerald-600 ml-2">· {normalCount} normal</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {analysisPhase === 'basic' && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" />
              Deep analysis in progress…
            </span>
          )}
          {analysisPhase === 'detailed' && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Analysis complete
            </span>
          )}
          <button onClick={onNewUpload} className="btn-ghost">
            <Upload className="w-4 h-4" />
            New upload
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Document + Voice Assistant */}
        <div className="space-y-4">
          {/* Document viewer */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title flex items-center gap-2">
                {isPDF ? <FileText className="w-4 h-4 text-slate-400" /> : <ImageIcon className="w-4 h-4 text-slate-400" />}
                Document
              </h2>
            </div>
            <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
              {isPDF && uploadedFile && (
                <div className="relative">
                  <iframe
                    src={`${uploadedFile.url}#toolbar=0&navpanes=0`}
                    className="w-full h-[420px] border-0"
                    title="Medical Report PDF"
                  />
                  <div className="pdf-fallback hidden p-8 text-center">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 mb-4">PDF preview unavailable</p>
                    <a href={uploadedFile.url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                      Open PDF in new tab
                    </a>
                  </div>
                </div>
              )}
              {isImage && uploadedFile && (
                <img
                  src={uploadedFile.url}
                  alt="Medical Report"
                  className="w-full max-h-[420px] object-contain"
                />
              )}
              {!isPDF && !isImage && (
                <div className="p-8 text-center text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">File uploaded successfully</p>
                </div>
              )}
            </div>
          </div>

          {/* Voice Assistant card */}
          {analysisPhase === 'detailed' && !showVoice && (
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
              <VoiceAgent patientInfo={patientInfo} extractedTests={extractedTests} />
            </div>
          )}
        </div>

        {/* Right: Summary */}
        <div className="card p-5">
          <h2 className="section-title mb-4">Health Summary</h2>
          <div className="space-y-4">
            {summaryData?.health_summary && (
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-700 leading-relaxed">{summaryData.health_summary}</p>
              </div>
            )}

            {summaryData?.concerning_findings && summaryData.concerning_findings.length > 0 && (
              <div className="bg-red-50 rounded-lg border border-red-200 p-4">
                <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  Concerning findings
                </div>
                <ul className="space-y-1.5">
                  {summaryData.concerning_findings.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                      <span className="w-1 h-1 rounded-full bg-red-400 mt-2 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summaryData?.dietary_recommendations && summaryData.dietary_recommendations.length > 0 && (
              <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
                <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm mb-2">
                  <Salad className="w-4 h-4" />
                  Dietary recommendations
                </div>
                <ul className="space-y-1.5">
                  {summaryData.dietary_recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summaryData?.lifestyle_recommendations && summaryData.lifestyle_recommendations.length > 0 && (
              <div className="bg-violet-50 rounded-lg border border-violet-200 p-4">
                <div className="flex items-center gap-2 text-violet-700 font-medium text-sm mb-2">
                  <Dumbbell className="w-4 h-4" />
                  Lifestyle recommendations
                </div>
                <ul className="space-y-1.5">
                  {summaryData.lifestyle_recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-violet-700">
                      <span className="w-1 h-1 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysisPhase !== 'detailed' && !summaryData?.health_summary && (
              <div className="flex items-center gap-3 py-6 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
                <span className="text-sm">Generating health insights…</span>
              </div>
            )}

            {!summaryData?.health_summary && analysisPhase === 'detailed' && (
              <div className="text-center py-6 text-slate-400">
                <p className="text-sm">No summary available for this report.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Patient info */}
      {patientInfo && (patientInfo.name || patientInfo.age || patientInfo.gender) && (
        <div className="card p-5">
          <h2 className="section-title mb-4">Patient Information</h2>
          <div className="flex flex-wrap gap-3">
            {patientInfo.name && (
              <div className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-400 mb-0.5">Name</div>
                <div className="text-sm font-semibold text-slate-900">{patientInfo.name}</div>
              </div>
            )}
            {patientInfo.age && (
              <div className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-400 mb-0.5">Age</div>
                <div className="text-sm font-semibold text-slate-900">{patientInfo.age} yrs</div>
              </div>
            )}
            {patientInfo.gender && (
              <div className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-400 mb-0.5">Gender</div>
                <div className="text-sm font-semibold text-slate-900">{patientInfo.gender}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Test results */}
      {extractedTests.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="section-title">Test Results <span className="font-normal text-slate-400">({extractedTests.length})</span></h2>
            <div className="flex items-center gap-2">
              <button onClick={handleDownloadTxt} className="btn-secondary text-xs">
                <Download className="w-3.5 h-3.5" />
                Export TXT
              </button>
              {saving && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
                </span>
              )}
              {saved && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </span>
              )}
            </div>
          </div>

          {hasDateGrouping ? (
            <div className="space-y-5">
              {dateOrder.map((date) => {
                const dateTests = testsByDate[date] ?? [];
                if (!dateTests.length) return null;
                return (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{date}</span>
                      <span className="text-xs text-slate-400">· {dateTests.length} tests</span>
                    </div>
                    <div className="space-y-2">
                      {dateTests.map((test, i) => <TestCard key={i} test={test} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedFlat.map((test, i) => <TestCard key={i} test={test} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Report;
