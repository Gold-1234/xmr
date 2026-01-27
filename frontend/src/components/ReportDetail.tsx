import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Image as ImageIcon, Calendar, User, TestTube } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
}

export default function ReportDetail({ reportId, onBack }: ReportDetailProps) {
  const { user } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [textContent, setTextContent] = useState<string>('');

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    loadReportDetail();
  }, [reportId]);

  // Fetch text content when report is loaded and it's a text file
  useEffect(() => {
    if (report && report.file_type.startsWith('text/')) {
      fetchTextContent();
    }
  }, [report]);

  // Function to get proxied image URL for Cloudinary images
  const getImageUrl = (originalUrl: string) => {
    if (originalUrl.startsWith('https://res.cloudinary.com/')) {
      return `${backendUrl}/proxy-image?url=${encodeURIComponent(originalUrl)}`;
    }
    return originalUrl;
  };

  // Function to fetch text content from Cloudinary URL
  const fetchTextContent = async () => {
    if (!report) return;

    try {
      const textUrl = getImageUrl(report.file_url); // Use proxy for Cloudinary URLs
      const response = await fetch(textUrl);
      if (response.ok) {
        const text = await response.text();
        setTextContent(text);
      } else {
        setTextContent('Error: Could not load text content');
      }
    } catch (err) {
      setTextContent('Error: Could not load text content');
    }
  };

  const loadReportDetail = async () => {
    if (!user) return;

    try {
      const response = await fetch(`${backendUrl}/report/${reportId}`);
      const data = await response.json();

      if (response.ok) {
        setReport(data);
      } else {
        setError(data.error || 'Failed to load report details');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report details');
    } finally {
      setLoading(false);
    }
  };

  // Sort tests by interpretation priority: High -> Normal -> Low -> Unknown
  const sortedTests = report?.test_results ? [...report.test_results].sort((a, b) => {
    const priority = { 'High': 4, 'Normal': 3, 'Low': 2, 'Unknown': 1 };
    return priority[b.interpretation] - priority[a.interpretation];
  }) : [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading report details...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Reports
            </button>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Report not found'}
          </div>
        </main>
      </div>
    );
  }

  const isPDF = report.file_type === 'application/pdf';
  const isImage = report.file_type.startsWith('image/');
  const isText = report.file_type.startsWith('text/');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Reports
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Report Details</h1>
              <p className="text-sm text-gray-600 mt-1">{report.filename}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            {formatDate(report.created_at)}
          </div>
          </div>
        </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              {isPDF || isText ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
              Original Report
            </h2>

            <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
              {isPDF && (
                <embed
                  src={report.file_url}
                  type="application/pdf"
                  className="w-full h-[600px] rounded-lg"
                />
              )}
              {isImage && (
                <img
                  src={getImageUrl(report.file_url)}
                  alt="Medical Report"
                  className="w-full max-h-[600px] object-contain rounded-lg"
                />
              )}
              {isText && (
                <pre className="whitespace-pre-wrap text-sm bg-white p-4 rounded border overflow-auto max-h-[600px] font-mono">
                  {textContent || 'Loading text content...'}
                </pre>
              )}
            </div>
          </div>

          {/* Analysis Results */}
          <div className="space-y-6">
            {/* Patient Information */}
            {(report.patient_name || report.patient_age || report.patient_gender) && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Patient Information
                </h3>
                <div className="space-y-3">
                  {report.patient_name && (
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm text-blue-600 font-medium">Name</span>
                      <span className="text-lg font-semibold text-gray-900">{report.patient_name}</span>
                    </div>
                  )}
                  {report.patient_age && (
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-sm text-green-600 font-medium">Age</span>
                      <span className="text-lg font-semibold text-gray-900">{report.patient_age} years</span>
                    </div>
                  )}
                  {report.patient_gender && (
                    <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                      <span className="text-sm text-purple-600 font-medium">Gender</span>
                      <span className="text-lg font-semibold text-gray-900">{report.patient_gender}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TestTube className="w-5 h-5" />
                Test Results ({sortedTests.length})
              </h3>

              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {sortedTests.map((test, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="text-lg font-semibold text-gray-900">{test.test_name}</h4>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        test.interpretation === 'Normal' ? 'bg-green-100 text-green-800' :
                        test.interpretation === 'High' ? 'bg-red-100 text-red-800' :
                        test.interpretation === 'Low' ? 'bg-yellow-100 text-yellow-800' :
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
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm text-blue-600 font-medium mb-1">Explanation</div>
                        <div className="text-sm text-gray-700">{test.explanation}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
              );
              }