'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchEvents, EventData } from '@/lib/dashboardApi';
import { Badge } from '@/components/ui/badge';

type StatusFilter = 'all' | '2xx' | '4xx' | '5xx';

const PAGE_SIZE = 25;

const statusFilters: { id: StatusFilter; label: string }[] = [ { id: 'all', label: 'All' }, { id: '2xx', label: '2xx' }, { id: '4xx', label: '4xx' }, { id: '5xx', label: '5xx' },];

function statusBadgeClass(code: number) {
  if (code >= 500) return 'bg-red-100 text-red-800 hover:bg-red-100';
  if (code >= 400) return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
  if (code >= 300) return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
  return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100';
}

function matchesFilter(event: EventData, filter: StatusFilter) {
  if (filter === 'all') return true;
  if (filter === '2xx') return event.status_code >= 200 && event.status_code < 300;
  if (filter === '4xx') return event.status_code >= 400 && event.status_code < 500;
  return event.status_code >= 500;
}

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface RequestDrillDownProps {
  route: string;
  teamId: string;
  startTime: string;
  endTime: string;
}

export function RequestDrillDown({ route, teamId, startTime, endTime }: RequestDrillDownProps) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['events', teamId, route, startTime, endTime, offset],
    queryFn: () => fetchEvents({ teamId, route, startTime, endTime, limit: PAGE_SIZE, offset }),
    staleTime: 15_000,
  });

  useEffect(() => {
    setEvents([]);
    setTotal(0);
    setOffset(0);
    setExpandedRequest(null);
  }, [teamId, route, startTime, endTime]);

  useEffect(() => {
    if (!data) return;
    setTotal(data.total ?? 0);
    setEvents((prev) => {
      if (offset === 0) return data.events ?? [];
      const next = [...prev];
      const existing = new Set(prev.map((e) => e.request_id));
      (data.events ?? []).forEach((e) => { if (!existing.has(e.request_id)) next.push(e); });
      return next;
    });
  }, [data, offset]);

  const filtered = events.filter((e) => matchesFilter(e, filter));
  const hasMore = events.length < total;

  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-zinc-500">Loading requests...</div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-zinc-500">No individual requests found for this route.</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
          {statusFilters.map((sf) => (
            <button
              key={sf.id}
              onClick={() => setFilter(sf.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === sf.id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
              }`}>{sf.label}</button>
          ))}
        </div>
        <span className="text-xs text-zinc-500">
          {filtered.length} of {total.toLocaleString()} requests
        </span>
      </div>

      <div className="border border-zinc-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="text-left px-3 py-2 font-medium text-zinc-600 w-20">Status</th>
              <th className="text-left px-3 py-2 font-medium text-zinc-600 w-16">Method</th>
              <th className="text-right px-3 py-2 font-medium text-zinc-600 w-24">Duration</th>
              <th className="text-left px-3 py-2 font-medium text-zinc-600">Time</th>
              <th className="text-left px-3 py-2 font-medium text-zinc-600 w-32">Error</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((event) => {
              const isExpanded = expandedRequest === event.request_id;
              const hasDetails = event.error_message || (event.metadata && Object.keys(event.metadata).length > 0);
              return (
                <tr
                  key={event.request_id}
                  onClick={() => hasDetails && setExpandedRequest(isExpanded ? null : event.request_id)}
                  className={`border-b border-zinc-100 last:border-0 ${
                    hasDetails ? 'cursor-pointer hover:bg-zinc-50' : ''
                  } ${isExpanded ? 'bg-zinc-50' : ''}`}>
                  <td className="px-3 py-2" colSpan={isExpanded ? 5 : undefined}>
                    {isExpanded ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <Badge variant="secondary" className={statusBadgeClass(event.status_code)}>{event.status_code}</Badge>
                          <span className="font-mono text-xs text-zinc-500">{event.method}</span>
                          <span className="text-zinc-900">{event.duration_ms}ms</span>
                          <span className="text-zinc-500">{formatTimestamp(event.timestamp)}</span>
                        </div>
                        {event.error_type && (
                          <div className="bg-red-50 border border-red-200 rounded-md p-3">
                            <div className="text-xs font-medium text-red-800 mb-1">{event.error_type}</div>
                            {event.error_message && (
                              <div className="text-xs text-red-700 font-mono whitespace-pre-wrap">{event.error_message}</div>
                            )}
                          </div>
                        )}
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <div className="bg-zinc-100 rounded-md p-3">
                            <div className="text-xs font-medium text-zinc-700 mb-1">Metadata</div>
                            <pre className="text-xs text-zinc-600 font-mono whitespace-pre-wrap">{JSON.stringify(event.metadata, null, 2)}</pre>
                          </div>
                        )}
                      </div>) : (
                      <Badge variant="secondary" className={statusBadgeClass(event.status_code)}>{event.status_code}</Badge>
                    )}
                  </td>
                  {!isExpanded && (
                    <>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-600">{event.method}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{event.duration_ms}ms</td>
                      <td className="px-3 py-2 text-zinc-500">{formatTimestamp(event.timestamp)}</td>
                      <td className="px-3 py-2">
                        {event.error_type ? (
                          <span className="text-red-600 text-xs">{event.error_type}</span>) : (
                          <span className="text-zinc-400 text-xs">-</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-500 text-xs">No requests match this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (<div className="text-center pt-1">
          <button
            onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors">
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
