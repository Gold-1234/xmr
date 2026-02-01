import React from 'react';
import { Loader2, Save } from 'lucide-react';
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
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  handleSaveReport: () => void;
  saving: boolean;
  saved: boolean;
}

interface TestsByDate {
  [date: string]: Test[];
}

const Report: React.FC<ReportProps> = ({
  extractedTests,
  patientInfo,
  uploadedFile,
  analysisPhase,
  basicAnalysis,
  analysisResult,
  onFileSelect,
  uploading,
  handleSaveReport,
  saving,
  saved
}) => {
  // Sort tests by interpretation priority: Abnormal (High/Low) -> Normal -> Unknown
  const sortedTests = [...extractedTests].sort((a, b) => {
    const priority = { 'High': 4, 'Low': 4, 'Normal': 2, 'Unknown': 1 };
    return priority[b.interpretation] - priority[a.interpretation];
  });

  const isPDF = uploadedFile?.type === 'application/pdf';
  const isImage = uploadedFile?.type.startsWith('image/');

  // Get summary data from the first test (where LLM stores summary data)
  const summaryData = extractedTests.length > 0 ? extractedTests[0] : null;

  // Check if we have date-grouped data
  const testsByDate: TestsByDate = analysisResult?.tests_by_date || {};
  const dateOrder: string[] = analysisResult?.date_order || [];
  const hasDateGrouping = Object.keys(testsByDate).length > 0 && dateOrder.length > 0;

  // Debug: Print what frontend receives
  console.log('🖥️ Frontend received analysisResult:', {
    hasAnalysisResult: !!analysisResult,
    testsCount: extractedTests?.length || 0,
    hasDateGrouping,
    testsByDateKeys: Object.keys(testsByDate),
    dateOrder,
    testsByDateSample: testsByDate ? Object.fromEntries(
      Object.entries(testsByDate).slice(0, 2).map(([date, tests]) => [
        date,
        tests.slice(0, 3).map(t => ({ name: t.test_name, value: t.value, interpretation: t.interpretation }))
      ])
    ) : {}
  });

  return (
    <div className="space-y-6">
      {/* Report || Summary Layout */}
      {uploadedFile && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Uploaded Report */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Uploaded Report</h2>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={onFileSelect}
                  disabled={uploading}
                  className="hidden"
                />
                <span className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                  Upload New File
                </span>
              </label>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
              {isPDF && uploadedFile && (
                <div className="w-full">
                  {uploadedFile?.url && (console.log('📄 PDF viewer URL:', uploadedFile?.url), null)}
                  <iframe
                    src={`${uploadedFile.url}#toolbar=0&navpanes=0&scrollbar=0`}
                    className="w-full h-[400px] rounded-lg border-0"
                    title="Medical Report PDF"
                    onError={async (e) => {
                      console.error('🚨 PDF iframe failed to load:', {
                        error: e,
                        url: uploadedFile.url,
                        iframe: e.currentTarget,
                        timestamp: new Date().toISOString(),
                        userAgent: navigator.userAgent
                      });

                      // Try to fetch the URL manually to check accessibility
                      try {
                        console.log('🔍 Testing manual fetch of PDF URL...');
                        const response = await fetch(uploadedFile.url, {
                          method: 'HEAD',
                          mode: 'cors'
                        });
                        console.log('📡 Manual fetch result:', {
                          status: response.status,
                          statusText: response.statusText,
                          headers: Object.fromEntries(response.headers.entries()),
                          url: uploadedFile.url,
                          ok: response.ok,
                          contentType: response.headers.get('content-type'),
                          contentLength: response.headers.get('content-length')
                        });
                      } catch (fetchError) {
                        console.error('🚨 Manual fetch also failed:', {
                          error: fetchError,
                          url: uploadedFile.url,
                          message: fetchError instanceof Error ? fetchError.message : 'Unknown error'
                        });
                      }

                      // Try without URL parameters as fallback
                      console.log('🔄 Retrying without URL parameters...');
                      const iframeWithoutParams = e.currentTarget.parentElement?.querySelector('.iframe-retry') as HTMLIFrameElement;
                      if (iframeWithoutParams) {
                        iframeWithoutParams.src = uploadedFile.url;
                        iframeWithoutParams.style.display = 'block';
                        e.currentTarget.style.display = 'none';
                        return;
                      }

                      // Show fallback if all attempts fail
                      console.log('📋 Showing fallback download link');
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.pdf-fallback');
                      if (fallback) (fallback as HTMLElement).style.display = 'block';
                    }}
                  />

                  {/* Hidden retry iframe without parameters */}
                  <iframe
                    src=""
                    className="iframe-retry w-full h-[400px] rounded-lg border-0"
                    style={{ display: 'none' }}
                    title="Medical Report PDF (Retry)"
                    onError={(e) => {
                      console.error('🚨 Retry iframe also failed:', {
                        url: uploadedFile.url,
                        error: e
                      });
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.pdf-fallback');
                      if (fallback) (fallback as HTMLElement).style.display = 'block';
                    }}
                  />

                  <div className="pdf-fallback hidden text-center py-8">
                    <div className="text-gray-500 mb-4">
                      <div className="text-4xl mb-2">📄</div>
                      <p>PDF Preview Not Available</p>
                      <p className="text-sm">Browser security prevents PDF embedding</p>
                      <p className="text-xs mt-2 text-gray-400">Check console (F12) for detailed error logs</p>
                    </div>
                    <a
                      href={uploadedFile.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-lg"
                    >
                      📥 Open PDF in New Tab
                    </a>
                  </div>
                </div>
              )}
              {isImage && uploadedFile && (
                <img
                  src={uploadedFile.url}
                  alt="Medical Report"
                  className="w-full max-h-[400px] object-contain rounded-lg"
                  onError={(e) => {
                    console.error('Image loading failed:', e);
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.image-fallback');
                    if (fallback) (fallback as HTMLElement).style.display = 'block';
                  }}
                />
              )}
              {!isPDF && !isImage && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📄</div>
                  <p>File uploaded successfully</p>
                  <p className="text-sm">Analysis in progress...</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: AI Summary */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">AI Health Summary</h2>

            <div className="space-y-6">
              {/* Health Summary */}
              {summaryData?.health_summary && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
                    <span className="mr-2">🏥</span>
                    Health Summary
                  </h3>
                  <p className="text-blue-800 leading-relaxed">{summaryData.health_summary}</p>
                </div>
              )}

              {/* Concerning Findings */}
              {summaryData?.concerning_findings && summaryData.concerning_findings.length > 0 && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 p-4 rounded-lg border border-red-200">
                  <h3 className="text-lg font-semibold text-red-900 mb-3 flex items-center">
                    <span className="mr-2">⚠️</span>
                    Concerning Findings
                  </h3>
                  <ul className="space-y-2">
                    {summaryData.concerning_findings.map((finding, index) => (
                      <li key={index} className="flex items-start text-red-800">
                        <span className="text-red-600 mr-2 mt-1">•</span>
                        <span className="leading-relaxed">{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Dietary Recommendations */}
              {summaryData?.dietary_recommendations && summaryData.dietary_recommendations.length > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                  <h3 className="text-lg font-semibold text-green-900 mb-3 flex items-center">
                    <span className="mr-2">🥗</span>
                    Dietary Recommendations
                  </h3>
                  <ul className="space-y-2">
                    {summaryData.dietary_recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start text-green-800">
                        <span className="text-green-600 mr-2 mt-1">•</span>
                        <span className="leading-relaxed">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Lifestyle Recommendations */}
              {summaryData?.lifestyle_recommendations && summaryData.lifestyle_recommendations.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-4 rounded-lg border border-purple-200">
                  <h3 className="text-lg font-semibold text-purple-900 mb-3 flex items-center">
                    <span className="mr-2">🏃‍♂️</span>
                    Lifestyle Recommendations
                  </h3>
                  <ul className="space-y-2">
                    {summaryData.lifestyle_recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start text-purple-800">
                        <span className="text-purple-600 mr-2 mt-1">•</span>
                        <span className="leading-relaxed">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Show loading state if no summary data yet */}
              {analysisPhase === 'detailed' && !summaryData?.health_summary && (
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p>Generating personalized health insights...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Separator Line */}
      {uploadedFile && extractedTests.length > 0 && (
        <div className="flex items-center justify-center py-4">
          <div className="flex-1 h-px bg-gray-300"></div>
          <span className="px-4 text-gray-500 font-medium">Detailed Results</span>
          <div className="flex-1 h-px bg-gray-300"></div>
        </div>
      )}

      {/* Test Results */}
      {extractedTests.length > 0 && (
        <div className="space-y-6">
          {/* Patient Information */}
          {patientInfo && (patientInfo.name || patientInfo.age || patientInfo.gender) && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Patient Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {patientInfo.name && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-blue-600 font-medium">Name</div>
                    <div className="text-lg font-semibold text-gray-900">{patientInfo.name}</div>
                  </div>
                )}
                {patientInfo.age && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-green-600 font-medium">Age</div>
                    <div className="text-lg font-semibold text-gray-900">{patientInfo.age} years</div>
                  </div>
                )}
                {patientInfo.gender && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-purple-600 font-medium">Gender</div>
                    <div className="text-lg font-semibold text-gray-900">{patientInfo.gender}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Test Results */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Test Results ({extractedTests.length})
              </h3>
              <div className="flex gap-3">
                {/* Download TXT Button */}
                <button
                  onClick={async () => {
                    try {
                      const backendUrl = import.meta.env.VITE_BACKEND_URL;
                      const response = await fetch(`${backendUrl}/download-txt`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          patient: patientInfo,
                          tests: extractedTests,
                          tests_by_date: analysisResult?.tests_by_date,
                          date_order: analysisResult?.date_order,
                          analysis_complete: true
                        }),
                      });

                      if (!response.ok) {
                        throw new Error('Download failed');
                      }

                      const result = await response.json();
                      if (result.success && result.txt_url) {
                        // Create a temporary link to download the file
                        const link = document.createElement('a');
                        link.href = result.txt_url;
                        link.download = result.filename || 'medical_report.txt';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      } else {
                        alert('Failed to generate TXT file');
                      }
                    } catch (error) {
                      console.error('Download error:', error);
                      alert('Failed to download TXT file');
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
                >
                  📄 Download TXT
                </button>

                {/* Save Report Button */}
                {!saved && (
                  <button
                    onClick={handleSaveReport}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <Loader2 className="animate-spin w-4 h-4" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saving ? 'Saving...' : 'Save Report'}
                  </button>
                )}
                {saved && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 font-medium rounded-lg">
                    <Save className="w-4 h-4" />
                    Report Saved
                  </div>
                )}
              </div>
            </div>

            {/* Date-wise or Flat Test Results */}
            {hasDateGrouping ? (
              <div className="space-y-6">
                {dateOrder.map((date) => {
                  const dateTests = testsByDate[date] || [];
                  if (dateTests.length === 0) return null;

                  return (
                    <div key={date} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center mb-4">
                        <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium mr-3">
                          📅 {date}
                        </div>
                        <span className="text-gray-600 text-sm">
                          {dateTests.length} test{dateTests.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {dateTests.map((test, index) => (
                          <div key={index} className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition">
                            <div className="flex justify-between items-start mb-2">
                              <h5 className="text-md font-semibold text-gray-900">{test.test_name}</h5>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                test.interpretation === 'Normal' ? 'bg-green-100 text-green-800' :
                                test.interpretation === 'High' ? 'bg-red-100 text-red-800' :
                                test.interpretation === 'Low' ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {test.interpretation}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                              <div>
                                <div className="text-xs text-gray-600">Value</div>
                                <div className="font-semibold text-gray-900 text-sm">
                                  {test.value} {test.unit && <span className="text-gray-500">({test.unit})</span>}
                                </div>
                              </div>
                              {test.reference_range && (
                                <div>
                                  <div className="text-xs text-gray-600">Reference Range</div>
                                  <div className="font-semibold text-gray-900 text-sm">{test.reference_range}</div>
                                </div>
                              )}
                            </div>

                            {test.explanation && (
                              <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="text-xs text-blue-600 font-medium mb-1">💡 AI Medical Explanation</div>
                                <div className="text-xs text-gray-700 leading-relaxed">{test.explanation}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {sortedTests.map((test, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="text-lg font-semibold text-gray-900">{test.test_name}</h4>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        test.interpretation === 'Normal' ? 'bg-green-100 text-green-800' :
                        test.interpretation === 'High' ? 'bg-red-100 text-red-800' :
                        test.interpretation === 'Low' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {test.interpretation}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="text-sm text-gray-600">Value</div>
                        <div className="font-semibold text-gray-900">
                          {test.value} {test.unit && <span className="text-gray-500">({test.unit})</span>}
                        </div>
                      </div>
                      {test.reference_range && (
                        <div>
                          <div className="text-sm text-gray-600">Reference Range</div>
                          <div className="font-semibold text-gray-900">{test.reference_range}</div>
                        </div>
                      )}
                    </div>

                    {test.explanation && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-sm text-blue-600 font-medium mb-1">💡 AI Medical Explanation</div>
                        <div className="text-sm text-gray-700 leading-relaxed">{test.explanation}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Voice Agent */}
      {extractedTests.length > 0 && (
        <VoiceAgent
          patientInfo={patientInfo}
          extractedTests={extractedTests}
        />
      )}
    </div>
  );
};

export default Report;