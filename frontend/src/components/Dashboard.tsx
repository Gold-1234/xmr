import { useState, useEffect } from 'react';
import { Upload, FileText, Image as ImageIcon, LogOut, Loader2, Save, BarChart3 } from 'lucide-react';
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

interface DashboardProps {
  onFileUpload: (file: File) => Promise<{ fileUrl: string; originalFileUrl: string; patient: Patient; tests: Test[] }>;
  onGoToReports: () => void;
}

export default function Dashboard({ onFileUpload, onGoToReports }: DashboardProps) {
  const { user, logout } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; originalUrl: string; type: string } | null>(null);
  const [patientInfo, setPatientInfo] = useState<Patient | null>(null);
  const [extractedTests, setExtractedTests] = useState<Test[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sort tests by interpretation priority: High -> Normal -> Low -> Unknown
  const sortedTests = [...extractedTests].sort((a, b) => {
    const priority = { 'High': 4, 'Normal': 3, 'Low': 2, 'Unknown': 1 };
    return priority[b.interpretation] - priority[a.interpretation];
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF, PNG, JPG, or JPEG file');
      return;
    }

    setUploading(true);
    setError('');
    setSaved(false); // Reset saved state for new upload

    try {
      const result = await onFileUpload(file);
      setUploadedFile({ url: result.fileUrl, originalUrl: result.originalFileUrl, type: file.type });
      setPatientInfo(result.patient);
      setExtractedTests(result.tests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveReport = async () => {
    if (!user || !uploadedFile || !patientInfo || extractedTests.length === 0) return;

    setSaving(true);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      const response = await fetch(`${backendUrl}/save-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          filename: uploadedFile.originalUrl.split('/').pop() || 'report',
          fileType: uploadedFile.type,
          fileUrl: uploadedFile.originalUrl,
          patient: patientInfo,
          tests: extractedTests,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSaved(true);
      } else {
        setError(result.error || 'Failed to save report');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  const isPDF = uploadedFile?.type === 'application/pdf';
  const isImage = uploadedFile?.type.startsWith('image/');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Medical Report Analyzer</h1>
            <p className="text-sm text-gray-600 mt-1">Welcome, {user?.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onGoToReports}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
            >
              <BarChart3 className="w-4 h-4" />
              My Reports
            </button>
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
              <p className="text-gray-600 mb-8">
                Upload a medical report (PDF or image) to extract and analyze test results
              </p>

              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="hidden"
                />
                <div className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-xl transition duration-200 inline-flex items-center gap-3 disabled:opacity-50">
                  {uploading ? (
                    <>
                      <Loader2 className="animate-spin w-6 h-6" />
                      <span>Processing...</span>
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
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Uploaded Report</h2>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    className="hidden"
                  />
                  <span className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                    Upload New File
                  </span>
                </label>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                {isPDF && (
                  <embed
                    src={uploadedFile.url}
                    type="application/pdf"
                    className="w-full h-[600px] rounded-lg"
                  />
                )}
                {isImage && (
                  <img
                    src={uploadedFile.url}
                    alt="Medical Report"
                    className="w-full max-h-[600px] object-contain rounded-lg"
                  />
                )}
              </div>
            </div>

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
            {extractedTests.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900">
                    Test Results ({extractedTests.length})
                  </h3>
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
                <div className="space-y-4">
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
            )}
          </div>
        )}
      </main>
    </div>
  );
}
