import { useState, useEffect } from 'react';
import { Trash2, FileText, Calendar, BarChart3, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
  test_results?: any[];
}

interface ReportsPageProps {
  onBack: () => void;
  onViewTrends: (testName: string) => void;
  onViewReport: (reportId: string) => void;
}

export default function ReportsPage({ onBack, onViewTrends, onViewReport }: ReportsPageProps) {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    if (!user) return;

    try {
      const response = await fetch(`${backendUrl}/reports/${user.id}`);
      const data = await response.json();

      if (response.ok) {
        setReports(data.reports || []);
      } else {
        setError(data.error || 'Failed to load reports');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!user) return;

    setDeleting(reportId);
    try {
      const response = await fetch(`${backendUrl}/report/${reportId}?user_id=${user.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setReports(reports.filter(r => r.id !== reportId));
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete report');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
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
          <p className="text-gray-600">Loading your reports...</p>
        </div>
      </div>
    );
  }

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
              Back to Dashboard
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Reports</h1>
              <p className="text-sm text-gray-600 mt-1">Manage your saved medical reports</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {reports.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Reports Yet</h3>
            <p className="text-gray-600">Upload and save your first medical report to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((report) => (
              <div key={report.id} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1 truncate" title={report.filename}>
                      {report.filename}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {formatDate(report.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(report.id)}
                    disabled={deleting === report.id}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                    title="Delete report"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {(report.patient_name || report.patient_age || report.patient_gender) && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 mb-1">Patient Info</div>
                    <div className="text-sm text-gray-600">
                      {report.patient_name && <span>{report.patient_name}</span>}
                      {report.patient_age && <span> • {report.patient_age} years</span>}
                      {report.patient_gender && <span> • {report.patient_gender}</span>}
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Tests ({report.extracted_tests?.length || 0})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {report.extracted_tests?.slice(0, 3).map((test, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {test}
                      </span>
                    ))}
                    {report.extracted_tests && report.extracted_tests.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        +{report.extracted_tests.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {/* View Report Button */}
                  <button
                    onClick={() => onViewReport(report.id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                  >
                    <FileText className="w-4 h-4" />
                    View Report
                  </button>

                  {/* Trend Buttons */}
                  {report.extracted_tests && report.extracted_tests.length > 0 && (
                    <div className="flex gap-2">
                      {report.extracted_tests.slice(0, 2).map((testName, index) => (
                        <button
                          key={index}
                          onClick={() => onViewTrends(testName)}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
                        >
                          <BarChart3 className="w-3 h-3" />
                          {testName}
                        </button>
                      ))}
                      {report.extracted_tests.length > 2 && (
                        <span className="flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg">
                          +{report.extracted_tests.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}