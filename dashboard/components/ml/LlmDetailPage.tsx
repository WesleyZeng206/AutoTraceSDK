'use client';

import { useMemo, useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useTeam } from '@/contexts/TeamContext';
import { MlNav } from './MlNav';
import { Sparkline } from './Sparkline';
import { fetchLlmSummary, fetchLlmEvents } from '@/lib/mlApi';

const num = (v: unknown) => Number(v ?? 0);
const fmt = (n: number) => n.toLocaleString();
const money = (n: number) => `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;
const ms = (v: unknown) => (v == null ? '—' : `${Math.round(num(v))} ms`);

const ranges = [
  { id: '24h', label: '24h', hours: 24 },
  { id: '7d', label: '7d', hours: 7 * 24 },
  { id: '30d', label: '30d', hours: 30 * 24 },
];

export default function LlmDetailPage() {
  const { currentTeam } = useTeam();
  const teamId = currentTeam?.id;

  const [rangeId, setRangeId] = useState('7d');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState('');

  const rangeHours = ranges.find((r) => r.id === rangeId)?.hours ?? 168;

  const { from, to } = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - rangeHours * 60 * 60 * 1000);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [rangeHours]);

  const summaryQuery = useQuery({
    queryKey: ['ml-summary-detail', teamId, from, to, provider, model],
    queryFn: () => fetchLlmSummary({ teamId: teamId!, from, to, provider: provider || undefined, model: model || undefined }),
    enabled: Boolean(teamId),
    staleTime: 30_000,
  });

  const eventsQuery = useInfiniteQuery({
    queryKey: ['ml-events', teamId, from, to, provider, model, status],
    queryFn: ({ pageParam }) =>
      fetchLlmEvents({
        teamId: teamId!,
        from,
        to,
        provider: provider || undefined,
        model: model || undefined,
        status: status || undefined,
        cursor: pageParam as string | undefined,
        limit: 50,
      }),
    enabled: Boolean(teamId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: 30_000,
  });

  const data = summaryQuery.data;
  const series = data?.timeseries ?? [];
  const callSeries = series.map((p) => num(p.calls));
  const costSeries = series.map((p) => num(p.total_cost_usd));
  const latencySeries = series.map((p) => num(p.avg_latency_ms));

  const cost = num(data?.total_cost_usd);
  const rangeDays = rangeHours / 24;
  const projectedMonthly = rangeDays > 0 ? (cost / rangeDays) * 30 : 0;

  const byModel = useMemo(
    () => [...(data?.by_model ?? [])].sort((a, b) => num(b.calls) - num(a.calls)),
    [data]
  );

  const events = eventsQuery.data?.pages.flatMap((p) => p.events) ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <MlNav active="/ml/llm" />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">ML Observability</p>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">LLM Usage</h1>
            <p className="text-sm text-zinc-400 mt-0.5">{currentTeam?.name}</p>
          </div>
          <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-lg p-1 shadow-sm">
            {ranges.map((r) => (
              <button
                key={r.id}
                onClick={() => setRangeId(r.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  rangeId === r.id ? 'bg-amber-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                }`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {!teamId ? (
          <div className="text-center py-16 text-zinc-400 text-sm">Select a team to view LLM usage.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <ChartCard title="Calls / hour" series={callSeries} stroke="#a78bfa" fill="rgba(167,139,250,0.12)" total={fmt(num(data?.calls))} />
              <ChartCard title="Cost / hour" series={costSeries} stroke="#f59e0b" fill="rgba(245,158,11,0.12)" total={money(cost)} />
              <ChartCard title="Avg latency / hour" series={latencySeries} stroke="#2dd4bf" fill="rgba(45,212,191,0.12)" total={ms(data?.avg_latency_ms)} />
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-6 mb-8 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Forecast</p>
                  <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Projected Monthly Cost</h2>
                  <p className="text-sm text-zinc-400 mt-0.5">Extrapolated from the selected {rangeId} window</p>
                </div>
                <div className="text-3xl font-bold text-zinc-900 font-mono tabular-nums">{money(projectedMonthly)}</div>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-6 mb-8 shadow-sm">
              <div className="mb-5">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Breakdown</p>
                <h2 className="text-base font-semibold text-zinc-900 tracking-tight">By Model</h2>
              </div>
              {summaryQuery.isLoading ? (
                <div className="py-12 text-center text-zinc-400 text-sm">Loading...</div>
              ) : byModel.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-sm">No data for this range.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-100">
                        <th className="py-2 pr-4">Provider</th>
                        <th className="py-2 pr-4">Model</th>
                        <th className="py-2 pr-4 text-right">Calls</th>
                        <th className="py-2 pr-4 text-right">Avg latency</th>
                        <th className="py-2 pr-4 text-right">Error rate</th>
                        <th className="py-2 pr-4 text-right">Tokens</th>
                        <th className="py-2 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byModel.map((m) => {
                        const reqs = num(m.calls);
                        const errRate = reqs > 0 ? (num(m.errors) / reqs) * 100 : 0;
                        return (
                          <tr key={`${m.provider}/${m.model}`} className="border-b border-zinc-50 last:border-0">
                            <td className="py-2.5 pr-4 text-zinc-500">{m.provider}</td>
                            <td className="py-2.5 pr-4 font-mono text-zinc-800">{m.model}</td>
                            <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{fmt(reqs)}</td>
                            <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-zinc-500">{ms(m.avg_latency_ms)}</td>
                            <td className={`py-2.5 pr-4 text-right font-mono tabular-nums ${errRate > 5 ? 'text-red-600' : errRate > 1 ? 'text-amber-600' : 'text-zinc-500'}`}>
                              {errRate.toFixed(1)}%
                            </td>
                            <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-zinc-500">{fmt(num(m.total_tokens))}</td>
                            <td className="py-2.5 text-right font-mono tabular-nums">{money(num(m.total_cost_usd))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Raw</p>
                  <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Event Log</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    placeholder="provider"
                    className="px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md w-32 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="model"
                    className="px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md w-40 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-400">
                    <option value="">all status</option>
                    <option value="success">success</option>
                    <option value="error">error</option>
                    <option value="timeout">timeout</option>
                  </select>
                </div>
              </div>

              {eventsQuery.isLoading ? (
                <div className="py-12 text-center text-zinc-400 text-sm">Loading events...</div>
              ) : events.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-sm">No events match these filters.</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-100">
                          <th className="py-2 pr-4">Time</th>
                          <th className="py-2 pr-4">Provider</th>
                          <th className="py-2 pr-4">Model</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4 text-right">Latency</th>
                          <th className="py-2 pr-4 text-right">Tokens</th>
                          <th className="py-2 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.map((e) => (
                          <tr key={String(e.id)} className="border-b border-zinc-50 last:border-0">
                            <td className="py-2.5 pr-4 text-zinc-500 whitespace-nowrap">{new Date(e.started_at).toLocaleString()}</td>
                            <td className="py-2.5 pr-4 text-zinc-500">{e.provider}</td>
                            <td className="py-2.5 pr-4 font-mono text-zinc-800">{e.model}</td>
                            <td className="py-2.5 pr-4">
                              <span
                                className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  e.status === 'success'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-red-50 text-red-700'
                                }`}>
                                {e.status}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-zinc-500">{ms(e.latency_ms)}</td>
                            <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-zinc-500">{e.total_tokens == null ? '—' : fmt(num(e.total_tokens))}</td>
                            <td className="py-2.5 text-right font-mono tabular-nums">{e.estimated_cost_usd == null ? '—' : money(num(e.estimated_cost_usd))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {eventsQuery.hasNextPage && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => eventsQuery.fetchNextPage()}
                        disabled={eventsQuery.isFetchingNextPage}
                        className="px-4 py-2 text-sm font-medium text-zinc-600 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-md transition-colors disabled:opacity-50">
                        {eventsQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, series, stroke, fill, total }: { title: string; series: number[]; stroke: string; fill: string; total: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{title}</p>
        <span className="text-sm font-bold text-zinc-900 font-mono tabular-nums">{total}</span>
      </div>
      <Sparkline values={series} height={56} stroke={stroke} fill={fill} />
    </div>
  );
}
