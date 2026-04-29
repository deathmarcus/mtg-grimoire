import { sparklineScale } from "@/lib/pricing";

type Props = {
  values: number[];
  width?: number;
  height?: number;
  ariaLabel: string;
  color?: string;
};

export function Sparkline({
  values,
  width = 320,
  height = 80,
  ariaLabel,
  color = "var(--accent)",
}: Props) {
  const points = sparklineScale(values, width, height);
  if (points.length === 0) {
    return (
      <p className="text-label-sm" style={{ color: "var(--ink-2)" }}>
        No price history yet.
      </p>
    );
  }

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  const areaPath = `${path} L${width},${height} L0,${height} Z`;

  // Use a unique gradient ID to avoid collisions when multiple sparklines render
  const gradientId = `sparkFill-${width}-${height}`;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: "100%" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
