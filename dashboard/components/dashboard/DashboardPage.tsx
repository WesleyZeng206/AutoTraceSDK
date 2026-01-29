'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { TeamSwitcher } from '@/components/TeamSwitcher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LatencyChart } from '@/components/LatencyChart';
import { EndpointTable } from '@/components/EndpointTable';
import { ResponseTimeDistribution } from '@/components/ResponseTimeDistribution';
import { AnomaliesCard } from '@/components/AnomaliesCard';
import { fetchMetrics, fetchServices, fetchStats, fetchRoutes, fetchDistribution, fetchAnomalies } from '@/lib/dashboardApi';

const timeRanges = [
  { id: '15m', label: '15m', hours: 0.25 },
  { id: '30m', label: '30m', hours: 0.5 },
  { id: '1h', label: '1h', hours: 1 },
  { id: '6h', label: '6h', hours: 6 },
  { id: '24h', label: '24h', hours: 24 },
  { id: '7d', label: '7d', hours: 7 * 24 },
];

const intervals = [
  { id: '15m', label: '15m' },
  { id: '30m', label: '30m' },
  { id: '1h', label: '1h' },
];

export default function DashboardPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const { currentTeam } = useTeam();
  const [selectedRange, setSelectedRange] = useState('1h');
  const [selectedInterval, setSelectedInterval] = useState('1h');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const rangeHours = useMemo(() => {
    const range = timeRanges.find((item) => item.id === selectedRange);
    return range?.hours ?? 1;
  }, [selectedRange]);

  const { startTime, endTime } = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - rangeHours * 60 * 60 * 1000);
    return { startTime: start.toISOString(), endTime: end.toISOString() };
  }, [rangeHours]);

  const teamId = currentTeam?.id;

  const statsQuery = useQuery({
    queryKey: ['stats', teamId, startTime, endTime],
    queryFn: () => fetchStats({ teamId: teamId!, startTime, endTime }),
    enabled: Boolean(teamId),
    staleTime: 30_000,
  });

  const servicesQuery = useQuery({
    queryKey: ['services', teamId],
    queryFn: () => fetchServices(teamId!),
    enabled: Boolean(teamId),
    staleTime: 60_000,
  });

  const metricsQuery = useQuery({
    queryKey: ['metrics', teamId, startTime, endTime, selectedInterval],
    queryFn: () => fetchMetrics({ teamId: teamId!, startTime, endTime, interval: selectedInterval }),
    enabled: Boolean(teamId),
    staleTime: 30_000,
  });

  const routesQuery = useQuery({
    queryKey: ['routes', teamId, startTime, endTime],
    queryFn: () => fetchRoutes({ teamId: teamId!, startTime, endTime }),
    enabled: Boolean(teamId),
    staleTime: 30_000,
  });

  const distributionQuery = useQuery({
    queryKey: ['distribution', teamId, startTime, endTime],
    queryFn: () => fetchDistribution({ teamId: teamId!, startTime, endTime }),
    enabled: Boolean(teamId),
    staleTime: 30_000,
  });

  const anomaliesQuery = useQuery({
    queryKey: ['anomalies', teamId, startTime, endTime],
    queryFn: () => fetchAnomalies({ teamId: teamId!, startTime, endTime, limit: 50 }),
    enabled: Boolean(teamId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  const stats = statsQuery.data;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-7 h-7 bg-zinc-900 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold text-xs">AT</span>
                </div>
                <span className="text-base font-semibold text-zinc-900">AutoTrace</span>
              </Link>
              <div className="flex items-center gap-1">
                <Link
                  href="/dashboard"
                  className="px-3 py-1.5 text-sm font-medium text-zinc-900 bg-zinc-100 rounded-md">
                  Dashboard
                </Link>
                <Link
                  href="/api-keys"
                  className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-md transition-colors">
                  API Keys
                </Link>
                <Link href="/team-members"
                  className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-md transition-colors">
                  Team
                </Link>
                <Link
                  href="/docs"
                  className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-md transition-colors">
                  Docs
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <TeamSwitcher />
              <div className="h-6 w-px bg-zinc-200" />
              <span className="text-sm text-zinc-600">{user?.username}</span>
              <button
                onClick={logout}
                className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {currentTeam?.name} &middot; Updated {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-lg p-1">
              {timeRanges.map((range) => (
                <button
                  key={range.id}
                  onClick={() => setSelectedRange(range.id)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    selectedRange === range.id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900'}`}>
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!teamId ? ( <div className="text-center py-16 text-zinc-500">
            Select a team to view metrics.
          </div> ) : statsQuery.isLoading ? (
          <div className="text-center py-16 text-zinc-500">
            Loading metrics...
          </div>) : (<> <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <div className="text-sm text-zinc-500 mb-1">Total Requests</div>
                <div className="text-3xl font-semibold text-zinc-900 tabular-nums">
                  {(stats?.totalRequests ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <div className="text-sm text-zinc-500 mb-1">Error Rate</div>
                <div className={`text-3xl font-semibold tabular-nums ${
                  (stats?.errorRate ?? 0) > 5 ? 'text-red-600' : (stats?.errorRate ?? 0) > 1 ? 'text-amber-600' : 'text-zinc-900'
                }`}>
                  {stats?.errorRate ?? 0}%
                </div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <div className="text-sm text-zinc-500 mb-1">Avg Latency</div>
                <div className="text-3xl font-semibold text-zinc-900 tabular-nums">
                  {stats?.avgLatency ?? 0}<span className="text-lg text-zinc-400 ml-0.5">ms</span>
                </div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <div className="text-sm text-zinc-500 mb-1">P50 Latency</div>
                <div className="text-3xl font-semibold text-zinc-900 tabular-nums">
                  {stats?.p50Latency ?? 0}<span className="text-lg text-zinc-400 ml-0.5">ms</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Latency Over Time</h2>
                  <p className="text-sm text-zinc-500">Response times across all endpoints</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-500">Interval:</span>
                  <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
                    {intervals.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setSelectedInterval(option.id)}
                        className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${
                          selectedInterval === option.id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                        }`}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <LatencyChart data={metricsQuery.data ?? []}
                isLoading={metricsQuery.isLoading}
                rangeHours={rangeHours}
                interval={selectedInterval}/>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-6 mb-8">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-zinc-900">Services</h2>
                <p className="text-sm text-zinc-500">Active services sending telemetry</p>
              </div>
              {servicesQuery.isLoading ? (
                <div className="py-8 text-center text-zinc-500">Loading services...</div>) : servicesQuery.data && servicesQuery.data.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {servicesQuery.data.map((service) => (
                    <div
                      key={service}
                      className="flex items-center justify-between p-4 bg-zinc-50 rounded-lg border border-zinc-100">
                      <span className="text-sm font-medium text-zinc-900 truncate">{service}</span>
                      <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        active
                      </span>
                    </div>
                  ))}
                </div> ) : (<div className="text-center py-12">
                  <p className="text-zinc-900 font-medium mb-2">No telemetry data yet</p>
                  <p className="text-sm text-zinc-500 mb-6">Get started by setting up your first service</p>
                  <div className="max-w-sm mx-auto bg-zinc-50 rounded-lg p-6 border border-zinc-200">
                    <ol className="text-left space-y-3 text-sm">
                      <li className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-medium">1</span>
                        <Link href="/api-keys" className="text-zinc-900 hover:underline">Create an API key</Link>
                      </li>
                      <li className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-medium">2</span>
                        <span className="text-zinc-600">Install the AutoTrace SDK</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-medium">3</span>
                        <span className="text-zinc-600">Configure and send telemetry</span>
                      </li>
                    </ol>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-8">
              <AnomaliesCard anomalies={anomaliesQuery.data ?? []} isLoading={anomaliesQuery.isLoading}/>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="bg-white border border-zinc-200 rounded-xl p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-zinc-900">Response Distribution</h2>
                  <p className="text-sm text-zinc-500">Requests by latency range</p>
                </div>
                {distributionQuery.isLoading ? (
                  <div className="py-12 text-center text-zinc-500">Loading...</div>
                ) : distributionQuery.data ? (
                  <ResponseTimeDistribution data={distributionQuery.data} /> ) : ( <div className="py-12 text-center text-zinc-500">No data available</div> )}
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl p-6 lg:col-span-2">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-zinc-900">Top Routes</h2>
                  <p className="text-sm text-zinc-500">Performance by endpoint</p>
                </div>
                {routesQuery.isLoading ? (
                  <div className="py-12 text-center text-zinc-500">Loading...</div>) : routesQuery.data ? (
                  <EndpointTable data={routesQuery.data} teamId={teamId} startTime={startTime} endTime={endTime} /> ) : (<div className="py-12 text-center text-zinc-500">No data available</div>)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
