import { log } from 'console';
import React, { useState } from 'react';

const CloudinaryTest: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError('');
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Add user profile if needed (optional for testing)
      const userProfile = {
        name: 'Test User',
        age: 30,
        bodyType: 'Average',
        currentGoal: 'Health Check',
        desiredOutcome: 'Detailed Report'
      };
      formData.append('user_profile', JSON.stringify(userProfile));

      const response = await fetch(`${backendUrl}/upload`, {
        method: 'POST',
        body: formData,
      });
	  console.log(response);
	  
      const result = await response.json();

      if (response.ok) {
        setUploadResult(result);
        console.log('Upload successful:', result);
      } else {
        setError(result.error || 'Upload failed');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const testImageProxy = async () => {
    if (!uploadResult?.fileUrl) {
      setError('Please upload a file first to test image proxy');
      return;
    }

    try {
      const proxyUrl = `${backendUrl}/proxy-image?url=${encodeURIComponent(uploadResult.fileUrl)}`;
      const response = await fetch(proxyUrl);

      if (response.ok) {
        console.log('Image proxy test successful');
        // You can add more detailed testing here
      } else {
        console.log('Image proxy test failed');
      }
    } catch (err) {
      console.error('Image proxy test error:', err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
        Cloudinary Upload Test
      </h2>

      <div className="space-y-4">
        {/* File Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select File to Upload
          </label>
          <input
            type="file"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            accept=".pdf,.png,.jpg,.jpeg,.txt"
          />
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? 'Uploading...' : 'Test Cloudinary Upload'}
        </button>

        {/* Test Image Proxy Button */}
        {uploadResult && (
          <button
            onClick={testImageProxy}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
          >
            Test Image Proxy
          </button>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 font-medium">Error:</p>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Results Display */}
        {uploadResult && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <h3 className="text-green-800 font-medium mb-2">Upload Successful!</h3>

            <div className="space-y-2 text-sm">
              <p><strong>File URL:</strong></p>
              <a
                href={uploadResult.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 break-all"
              >
                {uploadResult.fileUrl}
              </a>

              {uploadResult.tests && (
                <p><strong>Tests Found:</strong> {uploadResult.tests.length}</p>
              )}

              {uploadResult.patient && (
                <div>
                  <p><strong>Patient Info:</strong></p>
                  <ul className="ml-4 list-disc">
                    {uploadResult.patient.name && <li>Name: {uploadResult.patient.name}</li>}
                    {uploadResult.patient.age && <li>Age: {uploadResult.patient.age}</li>}
                    {uploadResult.patient.gender && <li>Gender: {uploadResult.patient.gender}</li>}
                  </ul>
                </div>
              )}
            </div>

            {/* Display uploaded image if it's an image */}
            {uploadResult.fileUrl && uploadResult.fileUrl.includes('res.cloudinary.com') && (
              <div className="mt-4">
                <p className="text-green-800 font-medium mb-2">Uploaded File Preview:</p>
                <img
                  src={uploadResult.fileUrl}
                  alt="Uploaded file"
                  className="max-w-full h-auto border border-gray-300 rounded"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="text-blue-800 font-medium mb-2">Testing Instructions:</h4>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• Upload PDF, image, or text files to test Cloudinary integration</li>
            <li>• Check browser console for detailed upload logs</li>
            <li>• Verify files are uploaded to the "medical_reports" folder on Cloudinary</li>
            <li>• Test image proxy functionality for uploaded images</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CloudinaryTest;