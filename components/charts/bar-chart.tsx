import { cn } from "@/lib/utils"
import { niceScale, r2, scaleY, type PlotBox } from "./utils"

interface BarChartProps {
  data: number[]
  labels: string[]
  /** Index of the bar to emphasise (brighter gold + gold axis label). */
  highlightIndex?: number
  formatValue?: (v: number) => string
  className?: string
  "aria-label"?: string
}

const W = 560
const H = 224
const box: PlotBox = { left: 44, right: 544, top: 16, bottom: 192 }

/** Flat rounded-top bar from the baseline up to `y` (charts.html · 03, "do"). */
function barPath(x: number, y: number, w: number, baseline: number): string {
  const r = Math.min(4, w / 2, baseline - y)
  return [
    `M${r2(x)},${baseline}`,
    `L${r2(x)},${r2(y + r)}`,
    `Q${r2(x)},${r2(y)} ${r2(x + r)},${r2(y)}`,
    `L${r2(x + w - r)},${r2(y)}`,
    `Q${r2(x + w)},${r2(y)} ${r2(x + w)},${r2(y + r)}`,
    `L${r2(x + w)},${baseline}`,
    "Z",
  ].join(" ")
}

/**
 * Flat bars on a single plane — height is the value. Bars sit on a `--border`
 * baseline over `--border-subtle` gridlines (charts.html · 03).
 */
export function BarChart({
  data,
  labels,
  highlightIndex,
  formatValue = (v) => String(v),
  className,
  "aria-label": ariaLabel,
}: BarChartProps) {
  const { min, max, values } = niceScale(0, Math.max(...data), 5)
  const baseline = box.bottom
  const slot = (box.right - box.left) / data.length
  const barW = slot * 0.55

  const bars = data.map((v, i) => {
    const cx = box.left + slot * (i + 0.5)
    return { x: r2(cx - barW / 2), y: r2(scaleY(v, min, max, box)), cx: r2(cx) }
  })

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      fill="none"
      role="img"
      aria-label={ariaLabel ?? "Bar chart"}
      className={cn("block h-auto w-full", className)}
    >
      {/* gridlines at --border-subtle, baseline one step up at --border */}
      <g style={{ stroke: "var(--border-subtle)" }} strokeWidth={1}>
        {values
          .filter((v) => v !== min)
          .map((v) => {
            const y = r2(scaleY(v, min, max, box))
            return <line key={v} x1={box.left} y1={y} x2={box.right} y2={y} />
          })}
      </g>
      <line
        x1={box.left}
        y1={baseline}
        x2={box.right}
        y2={baseline}
        style={{ stroke: "var(--border)" }}
        strokeWidth={1}
      />

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

      {/* bars */}
      {bars.map((b, i) => (
        <path
          key={i}
          d={barPath(b.x, b.y, barW, baseline)}
          style={{ fill: i === highlightIndex ? "var(--gold-300)" : "var(--chart-1)" }}
        />
      ))}

      {/* x-axis labels */}
      <g className="font-mono tabular-nums text-[9.5px]" textAnchor="middle">
        {bars.map((b, i) => (
          <text
            key={i}
            x={b.cx}
            y={212}
            style={{
              fill: i === highlightIndex ? "var(--chart-1)" : "var(--foreground-tertiary)",
            }}
          >
            {labels[i]}
          </text>
        ))}
      </g>
    </svg>
  )
}
