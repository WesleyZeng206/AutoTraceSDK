'use client';

import { AnomalyData } from '@/lib/dashboardApi';

interface AnomaliesCardProps {
  anomalies: AnomalyData[];
  isLoading: boolean;
}

const severityConfig = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  },
  info: {
    bg: 'bg-zinc-50',
    border: 'border-zinc-200',
    badge: 'bg-zinc-100 text-zinc-700',
    dot: 'bg-zinc-400',
  },
};

export function AnomaliesCard({ anomalies, isLoading }: AnomaliesCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-zinc-900">Anomalies</h2>
          <p className="text-sm text-zinc-500">Recent anomalies detected</p>
        </div>
        <div className="py-12 text-center text-zinc-500">Loading anomalies...</div>
      </div>
    );
  }

  if (!anomalies || anomalies.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-zinc-900">Anomalies</h2>
          <p className="text-sm text-zinc-500">Recent anomalies detected</p>
        </div>
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-50 rounded-full mb-3">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <p className="text-zinc-900 font-medium">All systems normal</p>
          <p className="text-sm text-zinc-500 mt-1">No anomalies detected</p>
        </div>
      </div>
    );
  }

  const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
  const warningCount = anomalies.filter(a => a.severity === 'warning').length;

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Anomalies</h2>
          <p className="text-sm text-zinc-500">
            {anomalies.length} anomal{anomalies.length === 1 ? 'y' : 'ies'} detected
          </p>
        </div>
        <div className="flex items-center gap-3">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {warningCount} warning
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {anomalies.slice(0, 20).map((anomaly) => {
          const config = severityConfig[anomaly.severity];
          const timestamp = new Date(anomaly.time_bucket);
          const relativeTime = getRelativeTime(timestamp);

          return (
            <div
              key={anomaly.id}
              className={`p-4 rounded-lg border ${config.bg} ${config.border}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${config.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                      {anomaly.severity}
                    </span>
                    <span className="text-sm font-medium text-zinc-900">{anomaly.service_name}</span>
                  </div>
                  <div className="text-sm text-zinc-600">
                    <code className="font-mono text-xs bg-white/50 px-1.5 py-0.5 rounded">
                      {anomaly.route}
                    </code>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {formatMetric(anomaly.metric)}: z-score {anomaly.score.toFixed(2)}
                    {' '}&middot;{' '}
                    baseline {anomaly.baseline_mean.toFixed(2)}{anomaly.metric === 'error_rate' ? '%' : 'ms'}
                  </div>
                </div>
                <span className="text-xs text-zinc-500 flex-shrink-0">{relativeTime}</span>
              </div>
            </div>
          );
        })}
      </div>

      {anomalies.length > 20 && (
        <div className="mt-4 text-center text-sm text-zinc-500">
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
    case 'avg_latency':
      return 'Avg latency';
    case 'error_rate':
      return 'Error rate';
    default:
      return metric;
  }
}
