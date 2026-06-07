import { fetchJson } from './http';

export interface LlmModelBreakdown {
  provider: string;
  model: string;
  calls: number | string;
  errors: number | string;
  prompt_tokens: number | string;
  completion_tokens: number | string;
  total_tokens: number | string;
  total_cost_usd: number | string;
  avg_latency_ms: number | string | null;
  p95_latency_ms: number | string | null;
  p99_latency_ms: number | string | null;
}

export interface LlmTimePoint {
  bucket: string;
  calls: number | string;
  avg_latency_ms: number | string | null;
  total_tokens: number | string | null;
  total_cost_usd: number | string | null;
}

export interface LlmSummary {
  calls: number;
  errors: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
  p99_latency_ms: number | null;
  by_model: LlmModelBreakdown[];
  timeseries: LlmTimePoint[];
}

export interface LlmEvent {
  id: number | string;
  idempotency_key: string | null;
  provider: string;
  model: string;
  operation: string;
  started_at: string;
  latency_ms: number | null;
  status: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | string | null;
  error_type: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

type Range = { teamId: string; from: string; to: string };

export async function fetchLlmSummary(p: Range & { provider?: string; model?: string }): Promise<LlmSummary> {
  const params: Record<string, string> = { teamId: p.teamId, startTime: p.from, endTime: p.to };
  if (p.provider) params.provider = p.provider;
  if (p.model) params.model = p.model;
  return fetchJson<LlmSummary>(buildUrl('/api/ml/summary', params));
}

export async function fetchLlmEvents(
  p: Range & { provider?: string; model?: string; status?: string; cursor?: string; limit?: number }
): Promise<{ events: LlmEvent[]; next_cursor: string | null }> {
  const params: Record<string, string> = { teamId: p.teamId, startTime: p.from, endTime: p.to };
  if (p.provider) params.provider = p.provider;
  if (p.model) params.model = p.model;
  if (p.status) params.status = p.status;
  if (p.cursor) params.cursor = p.cursor;
  if (p.limit) params.limit = String(p.limit);
  return fetchJson(buildUrl('/api/ml/events', params));
}

function buildUrl(path: string, params: Record<string, string>) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}
