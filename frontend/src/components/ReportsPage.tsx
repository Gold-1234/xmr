import { useState, useEffect } from 'react';
import { Trash2, FileText, Calendar, TrendingUp, Eye, Search, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { backendUrl, readJsonResponse } from '../utils/api';
import { getStatusClass } from '../utils/trendUtils';

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
  test_results?: Array<{ interpretation: string }>;
}

interface ReportsPageProps {
  onViewTrends: (testName: string) => void;
  onViewReport: (reportId: string) => void;
}

function formatDate(ds: string) {
  return new Date(ds).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function ReportCard({
  report,
  onView,
  onDelete,
  onTrend,
  deleting,
}: {
  report: Report;
  onView: () => void;
  onDelete: () => void;
  onTrend: (t: string) => void;
  deleting: boolean;
}) {
  const abnormal = report.test_results?.filter(t => t.interpretation === 'High' || t.interpretation === 'Low').length ?? 0;
  const normal = report.test_results?.filter(t => t.interpretation === 'Normal').length ?? 0;
  const tests = report.extracted_tests ?? [];

  return (
    <div className="card-hover p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate" title={report.filename}>
            {report.filename}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
            <Calendar className="w-3 h-3" />
            {formatDate(report.created_at)}
          </div>
        </div>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
          title="Delete report"
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Patient info */}
      {(report.patient_name || report.patient_age) && (
        <div className="text-xs text-slate-600">
          <span className="font-medium">{report.patient_name || 'Unknown patient'}</span>
          {report.patient_age && <span className="text-slate-400"> · {report.patient_age} yrs</span>}
          {report.patient_gender && <span className="text-slate-400"> · {report.patient_gender}</span>}
        </div>
      )}

      {/* Status summary */}
      {(abnormal > 0 || normal > 0) && (
        <div className="flex items-center gap-2">
          {abnormal > 0 && (
            <span className="badge-high">{abnormal} abnormal</span>
          )}
          {normal > 0 && (
            <span className="badge-normal">{normal} normal</span>
          )}
        </div>
      )}

      {/* Test tags */}
      {tests.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tests.slice(0, 4).map((t, i) => (
            <span key={i} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
              {t}
            </span>
          ))}
          {tests.length > 4 && (
            <span className="text-xs px-2 py-0.5 text-slate-400">+{tests.length - 4} more</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-slate-100">
        <button onClick={onView} className="btn-primary flex-1 justify-center text-xs py-2">
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
        {tests.length > 0 && (
          <button
            onClick={() => onTrend(tests[0])}
            className="btn-secondary flex-1 justify-center text-xs py-2"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Trends
          </button>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage({ onViewTrends, onViewReport }: ReportsPageProps) {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${backendUrl}/reports/${user.id}`);
      const data = await readJsonResponse<any>(response);
      if (response.ok) setReports(data.reports ?? []);
      else setError(data.error ?? 'Failed to load reports');
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
      const response = await fetch(`${backendUrl}/report/${reportId}?user_id=${user.id}`, { method: 'DELETE' });
      if (response.ok) setReports(r => r.filter(x => x.id !== reportId));
      else {
        const data = await readJsonResponse<any>(response);
        setError(data.error ?? 'Failed to delete report');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const filtered = reports.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.filename.toLowerCase().includes(q) ||
      (r.patient_name ?? '').toLowerCase().includes(q) ||
      (r.extracted_tests ?? []).some(t => t.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy-800 border-t-transparent mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading reports…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="page-title">My Reports</h1>
          <p className="text-muted mt-1">{reports.length} saved report{reports.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {reports.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by filename, patient name, or test…"
            className="input pl-9 max-w-sm"
          />
        </div>
      )}

      {reports.length === 0 ? (
        <div className="card p-16 text-center">
          <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-slate-700 mb-1">No reports yet</h3>
          <p className="text-sm text-slate-400">Upload and save a medical report to see it here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No reports match "{search}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(report => (
            <ReportCard
              key={report.id}
              report={report}
              onView={() => onViewReport(report.id)}
              onDelete={() => handleDelete(report.id)}
              onTrend={onViewTrends}
              deleting={deleting === report.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
