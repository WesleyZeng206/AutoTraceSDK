'use client';

import { AnomalyData } from '@/lib/dashboardApi';

interface AnomaliesCardProps {
  anomalies: AnomalyData[];
  isLoading: boolean;
}

const severityConfig = {
  critical: {
    dot: 'bg-red-500', label: 'CRIT',
    labelColor: 'text-red-600',
    bar: 'bg-red-400',
    row: 'hover:bg-red-50/30',
  },
  warning: { dot: 'bg-amber-400',
    label: 'WARN',
    labelColor: 'text-amber-600',
    bar: 'bg-amber-400',
    row: 'hover:bg-amber-50/30',
  },
  info: { dot: 'bg-zinc-400',
    label: 'INFO',
    labelColor: 'text-zinc-500',
    bar: 'bg-zinc-300',
    row: 'hover:bg-zinc-50',
  },
};

export function AnomaliesCard({ anomalies, isLoading }: AnomaliesCardProps) {
  const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
  const warningCount = anomalies.filter(a => a.severity === 'warning').length;
  const hasAlerts = anomalies.length > 0;

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-0.5">Monitoring</p>
            <h2 className="text-base font-semibold text-zinc-900 tracking-tight leading-none">Anomalies</h2>
          </div>
          {hasAlerts && ( <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />)} </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {criticalCount} critical
            </span>)}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {warningCount} warning
            </span>)}
          {!hasAlerts && !isLoading && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              all clear
            </span>
          )}
        </div>
      </div>

      {hasAlerts && !isLoading && (
        <div className="flex items-center gap-3 px-5 py-2 border-b border-zinc-100 bg-zinc-50/60">
          <div className="w-16 flex-shrink-0 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Sev</div>
          <div className="flex-1 min-w-0 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Service · Route</div>
          <div className="w-28 flex-shrink-0 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider hidden sm:block">Deviation</div>
          <div className="w-20 flex-shrink-0 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider hidden lg:block text-right">Baseline</div>
          <div className="w-7 flex-shrink-0 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider text-right">Age</div>
        </div>
      )}

      {isLoading ? ( <div className="py-12 text-center text-zinc-400 text-sm">Scanning for anomalies...</div>) : !hasAlerts ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-emerald-50 rounded-full mb-3">
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-700">All systems normal</p>
          <p className="text-xs text-zinc-400 mt-1">No anomalies detected in this time window</p>
        </div>) : (
        <div className="divide-y divide-zinc-100 max-h-80 overflow-y-auto">
          {anomalies.slice(0, 20).map((anomaly) => {
            const config = severityConfig[anomaly.severity];
            const relativeTime = getRelativeTime(new Date(anomaly.time_bucket));
            const zNorm = Math.min(anomaly.score / 5, 1);

            return (
              <div key={anomaly.id} className={`flex items-center gap-3 px-5 py-2.5 transition-colors ${config.row}`}>
                <div className="w-16 flex-shrink-0 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
                  <span className={`text-[11px] font-bold tracking-wide tabular-nums ${config.labelColor}`}>
                    {config.label}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-zinc-700">{anomaly.service_name}</span>
                    <span className="text-zinc-300 text-xs">·</span>
                    <code className="text-[11px] font-mono text-zinc-700 truncate">{anomaly.route}</code>
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5 uppercase tracking-wide">{formatMetric(anomaly.metric)}</div>
                </div>

                <div className="w-28 flex-shrink-0 hidden sm:flex items-center gap-2">
                  <div className="flex-1 h-1 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${config.bar}`}
                      style={{ width: `${zNorm * 100}%` }} />
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-zinc-800 tabular-nums w-9 text-right">
                    z={anomaly.score.toFixed(1)}
                  </span>
                </div>

                <div className="w-20 flex-shrink-0 hidden lg:block text-right">
                  <span className="text-[11px] font-mono text-zinc-600 tabular-nums">
                    {anomaly.baseline_mean.toFixed(anomaly.metric === 'error_rate' ? 1 : 0)}{anomaly.metric === 'error_rate' ? '%' : 'ms'} base
                  </span>
                </div>

                <span className="w-7 text-right font-mono text-[11px] text-zinc-400 flex-shrink-0">{relativeTime}</span>
              </div>);
          })}
        </div>
      )}

      {anomalies.length > 20 && (
        <div className="px-6 py-3 border-t border-zinc-100 text-center text-xs text-zinc-400">
          Showing 20 of {anomalies.length} anomalies
        </div>
      )}
    </div>
  );
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

function formatMetric(metric: string): string {
  switch (metric) {
    case 'avg_latency': return 'avg latency';
    case 'error_rate': return 'error rate';
    default: return metric;
  }
}
