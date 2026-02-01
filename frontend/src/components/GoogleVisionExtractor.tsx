import React, { useState } from 'react';
import { Upload, FileText, Calendar, Stethoscope, Loader2 } from 'lucide-react';

interface ExtractedInfo {
  pages: Array<{
    page_number: number;
    text: string;
    dates: string[];
    report_types: string[];
  }>;
  dates: string[];
  report_types: string[];
  all_text: string;
}

const GoogleVisionExtractor: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedInfo, setExtractedInfo] = useState<ExtractedInfo | null>(null);
  const [error, setError] = useState<string>('');

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Please select a PDF file');
        return;
      }
      setSelectedFile(file);
      setError('');
      setExtractedInfo(null);
    }
  };

  const handleExtract = async () => {
    if (!selectedFile) {
      setError('Please select a PDF file first');
      return;
    }

    setExtracting(true);
    setError('');
    setExtractedInfo(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${backendUrl}/extract-pdf-info`, {
        method: 'POST',
        body: formData,
      });
	  console.log(response)
      const result = await response.json();

      if (response.ok) {
        setExtractedInfo(result);
        console.log('Extraction successful:', result);
      } else {
        setError(result.error || 'Extraction failed');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Extraction error:', err);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
        Google Cloud Vision PDF Extractor
      </h2>

      <div className="space-y-6">
        {/* File Input */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
            id="pdf-upload"
          />
          <label htmlFor="pdf-upload" className="cursor-pointer">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              {selectedFile ? selectedFile.name : 'Click to select a PDF file'}
            </p>
            <p className="text-sm text-gray-500">
              Only PDF files are supported for Google Cloud Vision processing
            </p>
          </label>
        </div>

        {selectedFile && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <FileText className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">{selectedFile.name}</p>
                <p className="text-sm text-blue-700">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Extract Button */}
        <button
          onClick={handleExtract}
          disabled={!selectedFile || extracting}
          className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
          {extracting ? (
            <>
              <Loader2 className="animate-spin w-5 h-5" />
              <span>Processing PDF with Google Cloud Vision...</span>
            </>
          ) : (
            <>
              <Stethoscope className="w-5 h-5" />
              <span>Extract Date & Report Type</span>
            </>
          )}
        </button>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 font-medium">Error:</p>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Results Display */}
        {extractedInfo && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                <span className="mr-2">✅</span>
                Extraction Complete
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-white p-4 rounded-lg border border-green-300">
                  <div className="flex items-center space-x-2 mb-2">
                    <Calendar className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900">Dates Found</span>
                  </div>
                  <p className="text-2xl font-bold text-green-800">{extractedInfo.dates.length}</p>
                  {extractedInfo.dates.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {extractedInfo.dates.slice(0, 3).map((date, idx) => (
                        <p key={idx} className="text-sm text-green-700">{date}</p>
                      ))}
                      {extractedInfo.dates.length > 3 && (
                        <p className="text-sm text-green-600">+{extractedInfo.dates.length - 3} more</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-white p-4 rounded-lg border border-green-300">
                  <div className="flex items-center space-x-2 mb-2">
                    <Stethoscope className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900">Report Types</span>
                  </div>
                  <p className="text-2xl font-bold text-green-800">{extractedInfo.report_types.length}</p>
                  {extractedInfo.report_types.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {extractedInfo.report_types.slice(0, 2).map((type, idx) => (
                        <p key={idx} className="text-sm text-green-700 truncate" title={type}>{type}</p>
                      ))}
                      {extractedInfo.report_types.length > 2 && (
                        <p className="text-sm text-green-600">+{extractedInfo.report_types.length - 2} more</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-white p-4 rounded-lg border border-green-300">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900">Pages Processed</span>
                  </div>
                  <p className="text-2xl font-bold text-green-800">{extractedInfo.pages.length}</p>
                  <p className="text-sm text-green-700 mt-2">
                    Total text: {extractedInfo.all_text.length} chars
                  </p>
                </div>
              </div>
            </div>

            {/* Detailed Dates */}
            {extractedInfo.dates.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Extracted Dates
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {extractedInfo.dates.map((date, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-blue-300">
                      <p className="font-mono text-blue-800">{date}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Report Types */}
            {extractedInfo.report_types.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center">
                  <Stethoscope className="w-5 h-5 mr-2" />
                  Detected Report Types
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {extractedInfo.report_types.map((type, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-purple-300">
                      <p className="text-purple-800 font-medium">{type}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Page-by-page details */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Page-by-Page Analysis
              </h3>
              <div className="space-y-4">
                {extractedInfo.pages.map((page) => (
                  <div key={page.page_number} className="bg-white p-4 rounded-lg border border-gray-300">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-semibold text-gray-900">Page {page.page_number}</h4>
                      <div className="text-sm text-gray-500">
                        {page.dates.length} dates, {page.report_types.length} types
                      </div>
                    </div>

                    {page.dates.length > 0 && (
                      <div className="mb-2">
                        <span className="text-sm font-medium text-gray-700">Dates: </span>
                        <span className="text-sm text-gray-600">{page.dates.join(', ')}</span>
                      </div>
                    )}

                    {page.report_types.length > 0 && (
                      <div className="mb-2">
                        <span className="text-sm font-medium text-gray-700">Types: </span>
                        <span className="text-sm text-gray-600">{page.report_types.join(', ')}</span>
                      </div>
                    )}

                    <details className="mt-3">
                      <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800">
                        Show extracted text ({page.text.length} chars)
                      </summary>
                      <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono text-gray-700 max-h-40 overflow-y-auto">
                        {page.text}
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="text-blue-800 font-medium mb-2">How it works:</h4>
          <ol className="text-blue-700 text-sm space-y-1 list-decimal list-inside">
            <li>Upload a PDF medical report</li>
            <li>Each page is converted to an image</li>
            <li>Google Cloud Vision OCR extracts text from each page</li>
            <li>AI analyzes the text to identify dates and medical report types</li>
            <li>Results are aggregated and displayed with page-by-page breakdown</li>
          </ol>
          <p className="text-xs text-blue-600 mt-2">
            Note: Requires Google Cloud Vision API credentials to be configured on the server.
          </p>
        </div>
      </div>
    </div>
  );
};

export default GoogleVisionExtractor;