'use client';

import { Fragment, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { RequestDrillDown } from './dashboard/RequestDrillDown';

interface EndpointData {
  id: string;
  route: string;
  method: string;
  avgLatency: number;
  requests: number;
  errorRate: number;
  status: 'healthy' | 'warning' | 'critical';
}

interface EndpointTableProps {
  data: EndpointData[];
  teamId?: string;
  startTime?: string;
  endTime?: string;
}

const statusColors = {
  healthy: 'bg-green-100 text-green-800 hover:bg-green-100',
  warning: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  critical: 'bg-red-100 text-red-800 hover:bg-red-100',
};

const methodColors = {
  GET: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  POST: 'bg-green-100 text-green-800 hover:bg-green-100',
  PUT: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  PATCH: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  DELETE: 'bg-red-100 text-red-800 hover:bg-red-100',
};

export function EndpointTable({ data, teamId, startTime, endTime }: EndpointTableProps) {
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  const canDrillDown = Boolean(teamId && startTime && endTime);

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Route</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Avg Latency</TableHead>
            <TableHead className="text-right">Requests</TableHead>
            <TableHead className="text-right">Error Rate</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                No route data available
              </TableCell>
            </TableRow>
          ) : (data.map((endpoint) => {
              const isExpanded = expandedRoute === endpoint.id;
              return (
                <Fragment key={endpoint.id}>
                  <TableRow
                    onClick={() => canDrillDown && setExpandedRoute(isExpanded ? null : endpoint.id)}
                    className={`${canDrillDown ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-zinc-50' : ''}`}>
                    <TableCell className="font-mono text-sm">
                      <span className="flex items-center gap-2">
                        {canDrillDown && (
                          <svg className={`w-3 h-3 text-zinc-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                        {endpoint.route}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={methodColors[endpoint.method as keyof typeof methodColors] || 'bg-gray-100 text-gray-800 hover:bg-gray-100'}>
                        {endpoint.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{endpoint.avgLatency}ms</TableCell>
                    <TableCell className="text-right">{endpoint.requests.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{endpoint.errorRate.toFixed(2)}%</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[endpoint.status] || 'bg-gray-100 text-gray-800 hover:bg-gray-100'}>
                        {endpoint.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {isExpanded && teamId && startTime && endTime && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-4 bg-zinc-50/50">
                        <RequestDrillDown route={endpoint.route} teamId={teamId} startTime={startTime} endTime={endTime} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}