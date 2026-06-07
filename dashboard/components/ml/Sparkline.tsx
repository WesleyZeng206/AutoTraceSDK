'use client';

interface SparklineProps {
  values: number[];
  height?: number;
  stroke?: string;
  fill?: string;
}

export function Sparkline({ values, height = 40, stroke = '#f59e0b', fill = 'rgba(245,158,11,0.12)' }: SparklineProps) {
  if (!values.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-zinc-300">
        no data
      </div>
    );
  }

  const w = 100;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const coords = values.map((v, i) => {
    const x = values.length === 1 ? w : (i / (values.length - 1)) * w;
    const y = height - ((v - min) / range) * height;
    return [x, y] as const;
  });

  const line = coords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `0,${height} ${line} ${w},${height}`;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <polygon points={area} fill={fill} stroke="none" />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
