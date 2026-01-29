import { fetchJson } from './http';

export interface DashboardStats {
  totalRequests: number;
  errorRate: number;
  avgLatency: number;
  p50Latency: number;
  p90Latency: number;
  p95Latency?: number;
  p99Latency?: number;
}

export interface MetricDataPoint {
  time_bucket: string;
  avg_latency: number;
  p50_latency: number;
  p90_latency: number;
  request_count: number;
  error_count: number;
}

type RangeParams = {
  teamId: string;
  startTime: string;
  endTime: string;
};

export async function fetchStats(params: RangeParams): Promise<DashboardStats> {
  const url = buildUrl('/api/stats', params);
  const { stats } = await fetchJson<{ stats: DashboardStats | null }>(url);
  return stats ?? { totalRequests: 0, errorRate: 0, avgLatency: 0, p50Latency: 0, p90Latency: 0 };
}

export async function fetchServices(teamId: string): Promise<string[]> {
  const url = buildUrl('/api/services', { teamId });
  const { services } = await fetchJson<{ services: string[] }>(url);
  return services;
}

export async function fetchMetrics(params: RangeParams & { interval: string }): Promise<MetricDataPoint[]> {
  const url = buildUrl('/api/metrics', params);
  const { metrics } = await fetchJson<{ metrics: MetricDataPoint[] }>(url);
  return metrics ?? [];
}

export interface RouteData {
  id: string;
  route: string;
  method: string;
  requests: number;
  errorRate: number;
  avgLatency: number;
  status: 'healthy' | 'warning' | 'critical';
}

export async function fetchRoutes(params: RangeParams): Promise<RouteData[]> {
  const url = buildUrl('/api/routes', { ...params, limit: '10' });
  const { routes } = await fetchJson<{ routes: RouteData[] }>(url);
  return routes ?? [];
}

export interface DistributionData {
  range: string;
  count: number;
}

export async function fetchDistribution(params: RangeParams): Promise<DistributionData[]> {
  const url = buildUrl('/api/distribution', params);
  const { distribution } = await fetchJson<{ distribution: DistributionData[] }>(url);
  return distribution ?? [];
}

export interface AnomalyData {
  id: string;
  team_id: string;
  service_name: string;
  route: string;
  time_bucket: string;
  metric: string;
  score: number;
  severity: 'info' | 'warning' | 'critical';
  baseline_mean: number;
  baseline_std: number | null;
  created_at: string;
}

export async function fetchAnomalies(params: RangeParams & { severity?: string; limit?: number; windowHours?: number }): Promise<AnomalyData[]> {
  const apiParams: Record<string, string> = {
    teamId: params.teamId,
    startTime: params.startTime,
    endTime: params.endTime,
    windowHours: (params.windowHours || 48).toString(),
  };

  if (params.severity) apiParams.severity = params.severity;
  if (params.limit) apiParams.limit = params.limit.toString();

  const url = buildUrl('/api/anomalies/realtime', apiParams);
  const { anomalies } = await fetchJson<{ anomalies: AnomalyData[] }>(url);
  return anomalies ?? [];
}

export interface EventData {
  request_id: string;
  service_name: string;
  route: string;
  method: string;
  status_code: number;
  duration_ms: number;
  timestamp: string;
  error_type: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface EventsResponse {
  events: EventData[];
  total: number;
  count: number;
}

export async function fetchEvents( params: RangeParams & { route: string; limit?: number; offset?: number; statusMin?: number; statusMax?: number }): Promise<EventsResponse> {
  const apiParams: Record<string, string> = {
    teamId: params.teamId,
    startTime: params.startTime,
    endTime: params.endTime,
    route: params.route,
  };
  
  if (params.limit) {
    apiParams.limit = params.limit.toString();
  }

  if (params.offset) apiParams.offset = params.offset.toString();

  if (params.statusMin) apiParams.statusMin = params.statusMin.toString();

  if (params.statusMax) apiParams.statusMax = params.statusMax.toString();

  const url = buildUrl('/api/telemetry', apiParams);
  return fetchJson<EventsResponse>(url);
}

function buildUrl(path: string, params: Record<string, string>) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}
