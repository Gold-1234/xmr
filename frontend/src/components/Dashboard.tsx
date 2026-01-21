import { useState } from 'react';
import { Upload, FileText, Image as ImageIcon, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import TestExplanationModal from './TestExplanationModal';

interface DashboardProps {
  onFileUpload: (file: File) => Promise<{ fileUrl: string; tests: string[] }>;
}

export default function Dashboard({ onFileUpload }: DashboardProps) {
  const { user, logout } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; type: string } | null>(null);
  const [extractedTests, setExtractedTests] = useState<string[]>([]);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [error, setError] = useState('');

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

    try {
      const result = await onFileUpload(file);
      setUploadedFile({ url: result.fileUrl, type: file.type });
      setExtractedTests(result.tests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
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
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
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
                  <div
                    className="w-full h-[600px] rounded-lg cursor-pointer overflow-hidden"
                    onClick={() => setSelectedTest("Full Report")}
                  >
                    <embed
                      src={uploadedFile.url}
                      type="application/pdf"
                      className="w-full h-full"
                    />
                  </div>
                )}
                {isImage && (
                  <img
                    src={uploadedFile.url}
                    alt="Medical Report"
                    className="w-full max-h-[600px] object-contain rounded-lg cursor-pointer"
                    onClick={() => setSelectedTest("Full Report")}
                  />
                )}
              </div>
            </div>

            {extractedTests.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Detected Tests ({extractedTests.length})
                </h3>
                <div className="flex flex-wrap gap-3">
                  {extractedTests.map((test, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedTest(test)}
                      className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg font-medium transition duration-200 flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      {test}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {selectedTest && (
        <TestExplanationModal
          testName={selectedTest}
          onClose={() => setSelectedTest(null)}
        />
      )}
    </div>
  );
}
