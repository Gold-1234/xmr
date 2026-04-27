export interface TrendPoint {
  report_id: string;
  test_name: string;
  value: string;
  unit: string | null;
  reference_range: string | null;
  interpretation: string;
  report_date: string;
  filename?: string;
}

export function extractNumericValue(value: string): number | null {
  if (!value) return null;
  const cleaned = value.toString().replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function sortByDate(data: TrendPoint[]): TrendPoint[] {
  return [...data].sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime());
}

export function calcTrend(data: TrendPoint[]): 'increasing' | 'decreasing' | 'stable' | 'insufficient' {
  const numeric = data
    .map(d => extractNumericValue(d.value))
    .filter((v): v is number => v !== null);
  if (numeric.length < 2) return 'insufficient';
  const first = numeric[0];
  const last = numeric[numeric.length - 1];
  if (first === 0) return 'stable';
  const pct = ((last - first) / Math.abs(first)) * 100;
  if (pct > 5) return 'increasing';
  if (pct < -5) return 'decreasing';
  return 'stable';
}

export function formatReportDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function getStatusClass(status: string): string {
  switch (status) {
    case 'Normal': return 'badge-normal';
    case 'High': return 'badge-high';
    case 'Low': return 'badge-low';
    default: return 'badge-unknown';
  }
}

export function getStatusColors(status: string): { point: string; border: string } {
  switch (status) {
    case 'Normal': return { point: '#059669', border: '#059669' };
    case 'High': return { point: '#DC2626', border: '#DC2626' };
    case 'Low': return { point: '#D97706', border: '#D97706' };
    default: return { point: '#94A3B8', border: '#94A3B8' };
  }
}

export function normalizeTestName(name: string): string {
  return name.trim().toLowerCase();
}
