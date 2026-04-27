import { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, AlertCircle,
  BarChart3, Calendar, Activity, Info
} from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler, ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAuth } from '../contexts/AuthContext';
import { backendUrl, readJsonResponse } from '../utils/api';
import {
  TrendPoint, extractNumericValue, sortByDate, calcTrend,
  formatReportDate, formatShortDate, getStatusClass, getStatusColors,
} from '../utils/trendUtils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface TrendChartProps {
  initialTestName?: string;
  onBack?: () => void;
}

function SummaryCard({
  label, value, sub, color,
}: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">{label}</div>
      <div className={`text-xl font-semibold ${color ?? 'text-slate-900'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function TrendChart({ initialTestName = '', onBack }: TrendChartProps) {
  const { user } = useAuth();
  const [allTests, setAllTests] = useState<string[]>([]);
  const [selectedTest, setSelectedTest] = useState(initialTestName);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [error, setError] = useState('');
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => { fetchAvailableTests(); }, []);
  useEffect(() => {
    if (selectedTest) fetchTrendData(selectedTest);
    else setTrendData([]);
  }, [selectedTest]);

  const fetchAvailableTests = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${backendUrl}/reports/${user.id}`);
      const data = await readJsonResponse<any>(res);
      if (res.ok) {
        const reports = data.reports ?? [];
        const testSet = new Set<string>();
        for (const r of reports) {
          for (const t of r.extracted_tests ?? []) testSet.add(t);
        }
        const sorted = Array.from(testSet).sort();
        setAllTests(sorted);
        if (!selectedTest && sorted.length > 0) setSelectedTest(sorted[0]);
      }
    } catch { /* silent */ } finally {
      setLoadingTests(false);
    }
  };

  const fetchTrendData = async (testName: string) => {
    if (!user) return;
    setLoadingTrend(true);
    setError('');
    try {
      const res = await fetch(`${backendUrl}/trends/${user.id}/${encodeURIComponent(testName)}`);
      const data = await readJsonResponse<any>(res);
      if (res.ok) {
        const sorted = sortByDate(data.trends ?? []);
        setTrendData(sorted);
      } else {
        setError(data.error ?? 'Failed to load trend data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trend data');
    } finally {
      setLoadingTrend(false);
    }
  };

  const numericPoints = trendData.map(d => extractNumericValue(d.value));
  const hasNumeric = numericPoints.some(v => v !== null);
  const trend = calcTrend(trendData);
  const latest = trendData[trendData.length - 1];
  const previous = trendData.length >= 2 ? trendData[trendData.length - 2] : null;
  const unit = trendData.find(d => d.unit)?.unit ?? '';
  const refRange = trendData.find(d => d.reference_range)?.reference_range ?? '';

  // Chart.js setup
  const chartData = {
    labels: trendData.map(d => formatShortDate(d.report_date)),
    datasets: [{
      label: selectedTest,
      data: numericPoints,
      borderColor: '#1B3A5C',
      backgroundColor: 'rgba(27, 58, 92, 0.06)',
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointBackgroundColor: trendData.map(d => getStatusColors(d.interpretation).point),
      pointBorderColor: trendData.map(d => getStatusColors(d.interpretation).border),
      pointBorderWidth: 2,
      pointRadius: 6,
      pointHoverRadius: 8,
    }],
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0F2137',
        titleColor: '#fff',
        bodyColor: 'rgba(255,255,255,0.75)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          title: (ctx) => {
            const item = trendData[ctx[0].dataIndex];
            return formatReportDate(item.report_date);
          },
          label: (ctx) => {
            const item = trendData[ctx.dataIndex];
            const lines = [`${item.value}${unit ? ' ' + unit : ''}`];
            if (item.interpretation !== 'Unknown') lines.push(`Status: ${item.interpretation}`);
            if (item.reference_range) lines.push(`Range: ${item.reference_range}`);
            if (item.filename) lines.push(`Source: ${item.filename}`);
            return lines;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: { color: '#94A3B8', font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: { color: '#94A3B8', font: { size: 11 } },
        title: unit ? { display: true, text: unit, color: '#94A3B8', font: { size: 11 } } : { display: false },
      },
    },
  };

  const trendColors: Record<string, string> = {
    increasing: 'text-red-600 bg-red-50 border-red-200',
    decreasing: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    stable: 'text-slate-600 bg-slate-50 border-slate-200',
    insufficient: 'text-slate-500 bg-slate-50 border-slate-200',
  };
  const TrendIcon = trend === 'increasing' ? TrendingUp : trend === 'decreasing' ? TrendingDown : Minus;
  const trendLabel: Record<string, string> = {
    increasing: 'Trending up', decreasing: 'Trending down', stable: 'Stable', insufficient: 'Not enough data',
  };

  if (loadingTests) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy-800 border-t-transparent mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading tests…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="page-title">Trend Analysis</h1>
        <p className="text-muted mt-1">Track how your lab values change across multiple reports over time.</p>
      </div>

      {allTests.length === 0 ? (
        <div className="card p-16 text-center">
          <BarChart3 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-slate-700 mb-1">No data yet</h3>
          <p className="text-sm text-slate-400 max-w-xs mx-auto">
            Save at least one report to start tracking trends. Upload a report from the Analyze tab.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Test selector */}
          <div className="card p-5">
            <label className="label">Select a test to track</label>
            <div className="relative max-w-xs">
              <button
                onClick={() => setSelectorOpen(o => !o)}
                className="input flex items-center justify-between cursor-pointer text-left"
              >
                <span className={selectedTest ? 'text-slate-900' : 'text-slate-400'}>
                  {selectedTest || 'Choose a test…'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${selectorOpen ? 'rotate-180' : ''}`} />
              </button>
              {selectorOpen && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-card-hover z-20 max-h-56 overflow-y-auto scrollbar-thin">
                  {allTests.map(t => (
                    <button
                      key={t}
                      onClick={() => { setSelectedTest(t); setSelectorOpen(false); }}
                      className={`w-full text-left px-3.5 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
                        t === selectedTest ? 'font-medium text-navy-800 bg-navy-50' : 'text-slate-700'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {allTests.length > 0 && (
              <p className="text-xs text-slate-400 mt-2">{allTests.length} tests available across your saved reports</p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {loadingTrend && (
            <div className="card p-10 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-navy-800 border-t-transparent mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Loading trend data…</p>
            </div>
          )}

          {!loadingTrend && selectedTest && trendData.length === 0 && (
            <div className="card p-12 text-center">
              <Activity className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-700 mb-1">No trend data for "{selectedTest}"</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Save additional reports containing this test to see how values change over time.
              </p>
            </div>
          )}

          {!loadingTrend && trendData.length === 1 && (
            <div className="card p-5 flex items-start gap-3 border-amber-200 bg-amber-50">
              <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Only one data point</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Trends need at least 2 measurements. Save more reports containing "{selectedTest}" to see a trend line.
                </p>
              </div>
            </div>
          )}

          {!loadingTrend && trendData.length > 0 && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard
                  label="Measurements"
                  value={String(trendData.length)}
                  sub={`${trendData.length === 1 ? '1 report' : `${trendData.length} reports`}`}
                />
                <SummaryCard
                  label="Latest Value"
                  value={latest ? `${latest.value}${unit ? ' ' + unit : ''}` : '—'}
                  sub={latest ? formatReportDate(latest.report_date) : undefined}
                  color={latest?.interpretation === 'High' ? 'text-red-600' : latest?.interpretation === 'Low' ? 'text-amber-600' : 'text-emerald-600'}
                />
                {previous && (
                  <SummaryCard
                    label="Previous Value"
                    value={`${previous.value}${unit ? ' ' + unit : ''}`}
                    sub={formatReportDate(previous.report_date)}
                  />
                )}
                <div className="card p-4">
                  <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Trend</div>
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${trendColors[trend]}`}>
                    <TrendIcon className="w-3 h-3" />
                    {trendLabel[trend]}
                  </div>
                  {refRange && <div className="text-xs text-slate-400 mt-2">Range: {refRange}</div>}
                </div>
              </div>

              {/* Status breakdown */}
              {trendData.length > 1 && (() => {
                const counts = trendData.reduce<Record<string, number>>((acc, d) => {
                  acc[d.interpretation] = (acc[d.interpretation] ?? 0) + 1;
                  return acc;
                }, {});
                return (
                  <div className="card p-5">
                    <h3 className="section-title mb-3">Status Distribution</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(counts).map(([status, count]) => (
                        <span key={status} className={`${getStatusClass(status)} text-xs`}>
                          {count}× {status}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Chart */}
              {hasNumeric && trendData.length > 1 && (
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="section-title">{selectedTest} over time</h3>
                    {unit && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">{unit}</span>}
                  </div>
                  <div className="h-[320px]">
                    <Line data={chartData} options={chartOptions} />
                  </div>
                  <div className="flex items-center gap-4 mt-3 flex-wrap">
                    {[
                      { color: '#059669', label: 'Normal' },
                      { color: '#DC2626', label: 'High' },
                      { color: '#D97706', label: 'Low' },
                      { color: '#94A3B8', label: 'Unknown' },
                    ].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: color, backgroundColor: color }} />
                        <span className="text-xs text-slate-500">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!hasNumeric && (
                <div className="card p-5 border-slate-200 bg-slate-50">
                  <div className="flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-500">
                      The values for "{selectedTest}" could not be parsed as numbers, so a chart cannot be rendered. The data table below shows all recorded values.
                    </p>
                  </div>
                </div>
              )}

              {/* Data table */}
              <div className="card p-5">
                <h3 className="section-title mb-4">All Measurements</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Value</th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Reference</th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendData.map((item, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {formatReportDate(item.report_date)}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-900">{item.value}</span>
                            {item.unit && <span className="text-slate-400 ml-1 text-xs">{item.unit}</span>}
                          </td>
                          <td className="py-3 px-3">
                            <span className={getStatusClass(item.interpretation)}>{item.interpretation}</span>
                          </td>
                          <td className="py-3 px-3 hidden sm:table-cell text-xs text-slate-400">
                            {item.reference_range ?? '—'}
                          </td>
                          <td className="py-3 px-3 hidden md:table-cell text-xs text-slate-400 max-w-[140px] truncate">
                            {item.filename ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
