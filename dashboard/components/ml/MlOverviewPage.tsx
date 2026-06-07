'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTeam } from '@/contexts/TeamContext';
import { MlNav } from './MlNav';
import { Sparkline } from './Sparkline';
import { fetchLlmSummary } from '@/lib/mlApi';

const num = (v: unknown) => Number(v ?? 0);
const fmt = (n: number) => n.toLocaleString();
const money = (n: number) => `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;

export default function MlOverviewPage() {
  const { currentTeam } = useTeam();
  const teamId = currentTeam?.id;

  const { from, to } = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from: start.toISOString(), to: end.toISOString() };
  }, []);

  const summaryQuery = useQuery({
    queryKey: ['ml-summary-overview', teamId, from, to],
    queryFn: () => fetchLlmSummary({ teamId: teamId!, from, to }),
    enabled: Boolean(teamId),
    staleTime: 30_000,
  });

  const data = summaryQuery.data;
  const calls = num(data?.calls);
  const errors = num(data?.errors);
  const errorRate = calls > 0 ? (errors / calls) * 100 : 0;
  const tokens = num(data?.total_tokens);
  const cost = num(data?.total_cost_usd);

  const series = data?.timeseries ?? [];
  const callSeries = series.map((p) => num(p.calls));
  const costSeries = series.map((p) => num(p.total_cost_usd));
  const tokenSeries = series.map((p) => num(p.total_tokens));

  const topModels = useMemo(
    () => [...(data?.by_model ?? [])].sort((a, b) => num(b.calls) - num(a.calls)).slice(0, 5),
    [data]
  );

  const errorColor = errorRate > 5 ? 'text-red-600' : errorRate > 1 ? 'text-amber-600' : 'text-zinc-900';

  const cards = [
    { label: 'LLM Calls', value: fmt(calls), series: callSeries, stripe: 'bg-violet-400', stroke: '#a78bfa', fill: 'rgba(167,139,250,0.12)' },
    { label: 'Total Tokens', value: fmt(tokens), series: tokenSeries, stripe: 'bg-teal-400', stroke: '#2dd4bf', fill: 'rgba(45,212,191,0.12)' },
    { label: 'Total Cost', value: money(cost), series: costSeries, stripe: 'bg-amber-400', stroke: '#f59e0b', fill: 'rgba(245,158,11,0.12)' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <MlNav active="/ml" />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">ML Observability</p>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Overview</h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              {currentTeam?.name}
              <span className="mx-1.5 text-zinc-300">·</span>
              <span className="text-xs">last 7 days</span>
            </p>
          </div>
          <Link
            href="/ml/llm"
            className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors">
            LLM detail →
          </Link>
        </div>

        {!teamId ? (
          <div className="text-center py-16 text-zinc-400 text-sm">Select a team to view ML metrics.</div>
        ) : summaryQuery.isLoading ? (
          <div className="text-center py-16 text-zinc-400 text-sm">Loading metrics...</div>
        ) : summaryQuery.isError ? (
          <div className="text-center py-16 text-red-400 text-sm">Failed to load metrics.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
              {cards.map((c) => (
                <div key={c.label} className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                  <div className={`h-0.5 ${c.stripe}`} />
                  <div className="p-5">
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">{c.label}</p>
                    <div className="text-3xl font-bold text-zinc-900 font-mono tabular-nums mb-3">{c.value}</div>
                    <Sparkline values={c.series} stroke={c.stroke} fill={c.fill} />
                  </div>
                </div>
              ))}

              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                <div className={`h-0.5 ${errorRate > 5 ? 'bg-red-400' : errorRate > 1 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <div className="p-5">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Error Rate</p>
                  <div className={`text-3xl font-bold font-mono tabular-nums ${errorColor}`}>
                    {errorRate.toFixed(1)}
                    <span className="text-lg font-normal ml-0.5">%</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-3">{fmt(errors)} of {fmt(calls)} calls</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
              <div className="mb-5">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Usage</p>
                <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Top Models</h2>
                <p className="text-sm text-zinc-400 mt-0.5">By call volume this week</p>
              </div>
              {topModels.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-sm">No LLM calls recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-100">
                        <th className="py-2 pr-4">Provider</th>
                        <th className="py-2 pr-4">Model</th>
                        <th className="py-2 pr-4 text-right">Calls</th>
                        <th className="py-2 pr-4 text-right">Tokens</th>
                        <th className="py-2 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topModels.map((m) => (
                        <tr key={`${m.provider}/${m.model}`} className="border-b border-zinc-50 last:border-0">
                          <td className="py-2.5 pr-4 text-zinc-500">{m.provider}</td>
                          <td className="py-2.5 pr-4 font-mono text-zinc-800">{m.model}</td>
                          <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{fmt(num(m.calls))}</td>
                          <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-zinc-500">{fmt(num(m.total_tokens))}</td>
                          <td className="py-2.5 text-right font-mono tabular-nums">{money(num(m.total_cost_usd))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
