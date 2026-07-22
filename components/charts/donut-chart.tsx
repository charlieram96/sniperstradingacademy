import { cn } from "@/lib/utils"
import { r2 } from "./utils"

interface DonutSegment {
  value: number
  /** Any CSS color — pass chart tokens, e.g. `"var(--chart-2)"`. */
  color: string
}

interface DonutChartProps {
  segments: DonutSegment[]
  centerLabel: string
  centerSubLabel?: string
  size?: number
  className?: string
  "aria-label"?: string
}

/**
 * Ring chart with a center total (charts.html · 04). Segments are laid out with
 * `pathLength=100` so each arc length is just its percentage of the whole. The
 * ring radius and stroke scale with `size` (from the canonical 180 → R64/S22)
 * so it never clips its viewBox at smaller sizes.
 */
export function DonutChart({
  segments,
  centerLabel,
  centerSubLabel,
  size = 180,
  className,
  "aria-label": ariaLabel,
}: DonutChartProps) {
  const R = r2(size * (64 / 180))
  const STROKE = r2(size * (22 / 180))
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1
  let offset = 0
  const arcs = segments.map((s) => {
    const pct = (s.value / total) * 100
    const arc = { pct: r2(pct), offset: r2(-offset), color: s.color }
    offset += pct
    return arc
  })

  const c = size / 2

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={ariaLabel ?? "Donut chart"}
      className={cn("block", className)}
    >
      <g transform={`rotate(-90 ${c} ${c})`} fill="none" strokeWidth={STROKE}>
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx={c}
            cy={c}
            r={R}
            pathLength={100}
            style={{ stroke: a.color }}
            strokeDasharray={`${a.pct} ${r2(100 - a.pct)}`}
            strokeDashoffset={a.offset}
          />
        ))}
      </g>
      <text
        x={c}
        y={centerSubLabel ? c - 3 : c + 6}
        textAnchor="middle"
        className="font-mono tabular-nums text-[24px] font-semibold tracking-tight"
        style={{ fill: "var(--gold-100)" }}
      >
        {centerLabel}
      </text>
      {centerSubLabel && (
        <text
          x={c}
          y={c + 15}
          textAnchor="middle"
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ fill: "var(--foreground-tertiary)" }}
        >
          {centerSubLabel}
        </text>
      )}
    </svg>
  )
}
