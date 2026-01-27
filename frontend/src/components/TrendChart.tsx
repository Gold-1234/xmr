import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAuth } from '../contexts/AuthContext';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface TrendData {
  id: string;
  report_id: string;
  test_name: string;
  value: string;
  unit: string | null;
  reference_range: string | null;
  interpretation: string;
  created_at: string;
  report_date: string;
}

interface TrendChartProps {
  testName: string;
  onBack: () => void;
}

export default function TrendChart({ testName, onBack }: TrendChartProps) {
  const { user } = useAuth();
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    loadTrendData();
  }, [testName]);

  const loadTrendData = async () => {
    if (!user) return;

    try {
      const response = await fetch(`${backendUrl}/trends/${user.id}/${testName}`);
      const data = await response.json();

      if (response.ok) {
        setTrendData(data.trends || []);
      } else {
        setError(data.error || 'Failed to load trend data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trend data');
    } finally {
      setLoading(false);
    }
  };

  // Process data for chart
  const processedData = trendData.map(item => ({
    ...item,
    numericValue: parseFloat(item.value.replace(/[^0-9.-]/g, '')) || 0,
    date: new Date(item.report_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  })).sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime());

  // Calculate trend
  const calculateTrend = () => {
    if (processedData.length < 2) return 'insufficient';

    const first = processedData[0].numericValue;
    const last = processedData[processedData.length - 1].numericValue;
    const change = ((last - first) / first) * 100;

    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  };

  const trend = calculateTrend();

  // Chart data
  const chartData = {
    labels: processedData.map(item => item.date),
    datasets: [
      {
        label: `${testName} Values`,
        data: processedData.map(item => item.numericValue),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointBackgroundColor: processedData.map(item => {
          switch (item.interpretation) {
            case 'High': return 'rgb(239, 68, 68)'; // red
            case 'Low': return 'rgb(245, 158, 11)'; // yellow
            case 'Normal': return 'rgb(34, 197, 94)'; // green
            default: return 'rgb(156, 163, 175)'; // gray
          }
        }),
        pointBorderColor: processedData.map(item => {
          switch (item.interpretation) {
            case 'High': return 'rgb(239, 68, 68)';
            case 'Low': return 'rgb(245, 158, 11)';
            case 'Normal': return 'rgb(34, 197, 94)';
            default: return 'rgb(156, 163, 175)';
          }
        }),
        pointBorderWidth: 2,
        pointRadius: 6,
      },
    ],
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `${testName} Trend Analysis`,
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const dataIndex = context.dataIndex;
            const item = processedData[dataIndex];
            return [
              `${testName}: ${item.value} ${item.unit || ''}`,
              `Status: ${item.interpretation}`,
              `Date: ${new Date(item.report_date).toLocaleDateString()}`
            ];
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: `Value ${processedData[0]?.unit ? `(${processedData[0].unit})` : ''}`
        }
      },
      x: {
        title: {
          display: true,
          text: 'Date'
        }
      }
    },
    elements: {
      point: {
        hoverRadius: 8,
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading trend data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        </main>
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
              Back to Reports
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{testName} Trends</h1>
              <p className="text-sm text-gray-600 mt-1">Historical analysis of your {testName} results</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {processedData.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Trend Data</h3>
            <p className="text-gray-600">Save reports containing {testName} to see trend analysis.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Trend Summary */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Trend Summary</h2>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                  trend === 'increasing' ? 'bg-red-100 text-red-800' :
                  trend === 'decreasing' ? 'bg-green-100 text-green-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {trend === 'increasing' && <TrendingUp className="w-4 h-4" />}
                  {trend === 'decreasing' && <TrendingDown className="w-4 h-4" />}
                  {trend === 'stable' && <Minus className="w-4 h-4" />}
                  {trend === 'insufficient' ? 'Insufficient Data' :
                   trend === 'increasing' ? 'Trending Up' :
                   trend === 'decreasing' ? 'Trending Down' : 'Stable'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-blue-600 font-medium">Total Measurements</div>
                  <div className="text-2xl font-bold text-blue-900">{processedData.length}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-green-600 font-medium">Latest Value</div>
                  <div className="text-2xl font-bold text-green-900">
                    {processedData[processedData.length - 1]?.value}
                    {processedData[processedData.length - 1]?.unit && (
                      <span className="text-sm text-green-600 ml-1">
                        {processedData[processedData.length - 1].unit}
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-sm text-purple-600 font-medium">Current Status</div>
                  <div className={`text-lg font-bold ${
                    processedData[processedData.length - 1]?.interpretation === 'Normal' ? 'text-green-900' :
                    processedData[processedData.length - 1]?.interpretation === 'High' ? 'text-red-900' :
                    processedData[processedData.length - 1]?.interpretation === 'Low' ? 'text-yellow-900' :
                    'text-gray-900'
                  }`}>
                    {processedData[processedData.length - 1]?.interpretation || 'Unknown'}
                  </div>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="h-[500px]">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Measurement History</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reference Range
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {processedData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(item.report_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.value} {item.unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            item.interpretation === 'Normal' ? 'bg-green-100 text-green-800' :
                            item.interpretation === 'High' ? 'bg-red-100 text-red-800' :
                            item.interpretation === 'Low' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.interpretation}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.reference_range || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}