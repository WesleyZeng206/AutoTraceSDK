'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, Brush } from 'recharts';

interface MetricDataPoint {
  time_bucket: string;
  avg_latency: number;
  p50_latency: number;
  p90_latency: number;
  request_count: number;
}

interface LatencyChartProps {
  data: MetricDataPoint[];
  rangeHours: number;
  interval: string;
  isLoading?: boolean;
}


export function LatencyChart({ data, rangeHours, interval, isLoading }: LatencyChartProps) {
  const [brushStartIndex, setBrushStartIndex] = useState<number>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number>(0);

  const axisFormatter = useMemo(() => {
    if (rangeHours >= 24) {
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });
    }
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  }, [rangeHours]);

  const tooltipFormatter = useMemo(() =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  , []);

  const chartData = useMemo(() => {
    return data
      .map((point) => {
        const bucketDate = new Date(point.time_bucket);
        const avgLatency = Number(point.avg_latency);
        const p50Latency = Number(point.p50_latency);
        const p90Latency = Number(point.p90_latency);
        const requestCount = Number(point.request_count);

        return {
          timestamp: bucketDate.getTime(),
          timeLabel: bucketDate.toISOString(),
          avgLatency: Math.round(avgLatency * 100) / 100,
          p50Latency: Math.round(p50Latency * 100) / 100,
          p90Latency: Math.round(p90Latency * 100) / 100,
          requests: requestCount,
          hasData: requestCount > 0,
        };
      })
      .filter(point => {
        return !isNaN(point.avgLatency) && !isNaN(point.p50Latency) && !isNaN(point.p90Latency) &&
               isFinite(point.avgLatency) && isFinite(point.p50Latency) && isFinite(point.p90Latency) &&
               point.avgLatency >= 0 && point.p50Latency >= 0 && point.p90Latency >= 0;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [data]);

  useEffect(() => {
    if (chartData && chartData.length > 0) {
      setBrushStartIndex(0);
      setBrushEndIndex(chartData.length - 1);
    }
  }, [chartData, rangeHours, interval]);

  const handleWheelZoom = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;

    event.preventDefault();
    if (!chartData || chartData.length === 0) {
      return;
    }

    const maxIndex = chartData.length - 1;
    const start = Math.max(0, Math.min(brushStartIndex, maxIndex));
    const end = Math.max(0, Math.min(brushEndIndex, maxIndex));

    const span = Math.max(1, end - start + 1);
    const center = Math.round((start + end) / 2);
    const zoomIn = event.deltaY < 0;
    const nextSpan = Math.max(1, Math.min(chartData.length, zoomIn ? Math.floor(span * 0.85) : Math.ceil(span / 0.85)));
    const nextStart = Math.max(0, Math.min(maxIndex - nextSpan + 1, center - Math.floor(nextSpan / 2)));
    const nextEnd = Math.min(maxIndex, nextStart + nextSpan - 1);

    if (nextStart === start && nextEnd === end) {
      return;
    }

    setBrushStartIndex(nextStart);
    setBrushEndIndex(nextEnd);
  }, [chartData, brushStartIndex, brushEndIndex]);

  const visibleChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) return chartData;
    return chartData.slice(brushStartIndex, brushEndIndex + 1);
  }, [chartData, brushStartIndex, brushEndIndex]);

  const calcInterval = (range: number): number => {
    const raw = range / 10;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;

    if (norm <= 1) return mag;
    if (norm <= 2) return 2 * mag;
    if (norm <= 5) return 5 * mag;
    return 10 * mag;
  };

  const { yAxisDomain, yAxisTicks } = useMemo(() => {
    if (!visibleChartData || visibleChartData.length === 0) {
      return { yAxisDomain: ['auto', 'auto'] as ['auto', 'auto'], yAxisTicks: undefined };
    }

    const withData = visibleChartData.filter(d => d.hasData);
    if (withData.length === 0) {
      return { yAxisDomain: [0, 100] as [number, number], yAxisTicks: [0, 25, 50, 75, 100] };
    }

    const vals = withData.flatMap(d => [d.avgLatency, d.p50Latency, d.p90Latency]).filter(v => v > 0);
    if (vals.length === 0) {
      return { yAxisDomain: [0, 100] as [number, number], yAxisTicks: [0, 25, 50, 75, 100] };
    }

    const max = Math.max(...vals);
    const range = max - Math.min(...vals);
    const step = calcInterval(range > 0 ? range : max);
    const domainMax = Math.ceil(max / step) * step;

    const ticks: number[] = [];
    for (let i = 0; i <= domainMax; i += step) ticks.push(i);

    return { yAxisDomain: [0, domainMax] as [number, number], yAxisTicks: ticks };
  }, [visibleChartData]);


  if (isLoading) {
    return (
      <Card className="border-2 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50">
          <CardTitle className="text-2xl">Latency Over Time</CardTitle>
          <CardDescription>Loading metrics data...</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-80 flex items-center justify-center">
            <div className="text-muted-foreground">Loading chart...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="border-2 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50">
          <CardTitle className="text-2xl">Latency Over Time</CardTitle>
          <CardDescription>Historical latency metrics</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-80 flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground mb-2">No metrics data available yet</p>
              <p className="text-sm text-muted-foreground">
                Metrics are aggregated hourly. Send some requests and check back soon.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50">
        <CardTitle className="text-2xl">Latency Over Time</CardTitle>
        <CardDescription>
          Latency metrics with auto-adjusted resolution by time range (excludes zero latency data points)
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="w-full" style={{ height: '500px', marginBottom: '10px' }} onWheel={handleWheelZoom}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={visibleChartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(value) => axisFormatter.format(new Date(value))}
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
                angle={-45}
                textAnchor="end"
                height={60}
                interval="preserveStartEnd"/>
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
                label={{
                  value: 'Latency (ms)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: -5,
                  style: { textAnchor: 'middle' }
                }}
                domain={yAxisDomain}
                ticks={yAxisTicks}
                tickCount={yAxisTicks?.length}/>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
                labelFormatter={(value) => tooltipFormatter.format(new Date(value as number))}
                formatter={(value: number, name: string) => {
                  const roundedValue = Math.round(value * 100) / 100;
                  return [`${roundedValue}ms`, name];
                }}/>
              <Legend verticalAlign="bottom" height={50} wrapperStyle={{ paddingTop: '30px' }} />
              <Line
                type="monotone"
                dataKey="avgLatency"
                stroke="hsl(142 76% 36%)"
                strokeWidth={2}
                name="Average"
                dot={{ fill: 'hsl(142 76% 36%)', r: 3 }}
                activeDot={{ r: 5 }}/>
              <Line
                type="monotone"
                dataKey="p50Latency"
                stroke="hsl(217 91% 60%)"
                strokeWidth={2}
                name="P50"
                dot={{ fill: 'hsl(217 91% 60%)', r: 3 }}
                activeDot={{ r: 5 }}/>
              <Line type="monotone"
                dataKey="p90Latency"
                stroke="hsl(24 100% 50%)"
                strokeWidth={2}
                name="P90"
                dot={{ fill: 'hsl(24 100% 50%)', r: 3 }}
                activeDot={{ r: 5 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full latency-chart-brush" style={{ height: '110px', position: 'relative' }}>
          <style dangerouslySetInnerHTML={{
            __html: `
              .latency-chart-brush .recharts-brush-texts text {
                transform: translateY(45px);
                text-anchor: middle !important;
              }
              .latency-chart-brush .recharts-brush-traveller text {
                transform: translate(0, 60px);
                text-anchor: middle !important;
              }
            `
          }} />
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 15, right: 30, left: 20, bottom: 35 }}>
              <Brush
                dataKey="timestamp"
                height={50}
                stroke="hsl(217 91% 60%)"
                fill="rgba(96, 165, 250, 0.15)"
                tickFormatter={(value) => axisFormatter.format(new Date(value))}
                travellerWidth={14}
                startIndex={brushStartIndex}
                endIndex={brushEndIndex}
                onChange={(range: any) => {
                  if (range && range.startIndex !== undefined && range.endIndex !== undefined) {
                    setBrushStartIndex(range.startIndex);
                    setBrushEndIndex(range.endIndex);
                  }
                }}>
                <Line
                  type="monotone"
                  dataKey="p90Latency"
                  stroke="hsl(24 100% 50%)"
                  strokeWidth={2}
                  dot={false}/>
              </Brush>
            </LineChart>
          </ResponsiveContainer>
        </div>
        {chartData && chartData.length > 0 && (brushStartIndex !== 0 || brushEndIndex !== chartData.length - 1) && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => {
                if (chartData && chartData.length > 0) {
                  setBrushStartIndex(0);
                  setBrushEndIndex(chartData.length - 1);
                }
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
              Reset Zoom
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
