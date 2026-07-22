import { cn } from "@/lib/utils"
import { chartId, niceScale, r2, scaleX, scaleY, type PlotBox } from "./utils"

interface AreaChartProps {
  data: number[]
  labels: string[]
  /** Format y-axis tick values (e.g. `(v) => \`${v}k\``). Defaults to the raw number. */
  formatValue?: (v: number) => string
  className?: string
  "aria-label"?: string
}

// Fixed 560×224 canvas: room for y labels at left, a right margin for the
// endpoint dot, and an x-label band at the bottom.
const W = 560
const H = 224
const BASELINE = 192 // area fill closes here; x labels sit below
const box: PlotBox = { left: 44, right: 544, top: 16, bottom: 176 }

/**
 * Gold-gradient area chart with round-number gridlines (charts.html · 02).
 * Data is normalised to a "nice" axis so the top point clears the frame and
 * the endpoint dot keeps right-margin headroom.
 */
export function AreaChart({
  data,
  labels,
  formatValue = (v) => String(v),
  className,
  "aria-label": ariaLabel,
}: AreaChartProps) {
  const id = chartId("area", data)
  const { min, max, values } = niceScale(Math.min(...data), Math.max(...data), 5)

  const pts = data.map((v, i) => ({
    x: r2(scaleX(i, data.length, box)),
    y: r2(scaleY(v, min, max, box)),
  }))
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
  const last = pts[pts.length - 1]
  const area = `${line} L${last.x},${BASELINE} L${pts[0].x},${BASELINE} Z`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      fill="none"
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel ?? "Area chart"}
      className={cn("block h-auto w-full", className)}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--chart-1)", stopOpacity: 0.3 }} />
          <stop offset="1" style={{ stopColor: "var(--chart-1)", stopOpacity: 0.01 }} />
        </linearGradient>
      </defs>

      {/* gridlines at --border-subtle */}
      <g style={{ stroke: "var(--border-subtle)" }} strokeWidth={1}>
        {values.map((v) => {
          const y = r2(scaleY(v, min, max, box))
          return <line key={v} x1={box.left} y1={y} x2={box.right} y2={y} />
        })}
      </g>

      {/* y-axis labels */}
      <g
        className="font-mono tabular-nums text-[9.5px]"
        style={{ fill: "var(--foreground-tertiary)" }}
        textAnchor="end"
      >
        {values.map((v) => (
          <text key={v} x={box.left - 8} y={r2(scaleY(v, min, max, box)) + 3}>
            {formatValue(v)}
          </text>
        ))}
      </g>

      {/* area + line */}
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        style={{ stroke: "var(--chart-1)" }}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* interior points + endpoint dot */}
      <g style={{ fill: "var(--background)", stroke: "var(--chart-1)" }} strokeWidth={1.5}>
        {pts.slice(0, -1).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} />
        ))}
      </g>
      <circle
        cx={last.x}
        cy={last.y}
        r={4}
        style={{ fill: "var(--gold-300)", stroke: "var(--background)" }}
        strokeWidth={1.5}
      />

      {/* x-axis labels */}
      <g
        className="font-mono tabular-nums text-[9.5px]"
        style={{ fill: "var(--foreground-tertiary)" }}
        textAnchor="middle"
      >
        {pts.map((p, i) => (
          <text key={i} x={p.x} y={212}>
            {labels[i]}
          </text>
        ))}
      </g>
    </svg>
  )
}
