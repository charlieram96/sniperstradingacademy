import { cn } from "@/lib/utils"
import { chartId, r2, scaleX, scaleY, type PlotBox } from "./utils"

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  className?: string
  "aria-label"?: string
}

/**
 * Inline gold sparkline — a shape, not a chart. No axes or labels; rides inside
 * stat tiles. The line stops short of the right edge so the endpoint dot keeps
 * its headroom and never clips the viewBox (charts.html · 01).
 */
export function Sparkline({
  data,
  width = 120,
  height = 36,
  className,
  "aria-label": ariaLabel,
}: SparklineProps) {
  const id = chartId("spk", data)
  // Fixed margins: 4px right so the Ø6 endpoint dot sits inside the frame,
  // 5px top/bottom so the dot's radius clears the edges at any height.
  const box: PlotBox = { left: 4, right: width - 4, top: 5, bottom: height - 5 }
  const min = Math.min(...data)
  const max = Math.max(...data)

  const pts = data.map((v, i) => ({
    x: r2(scaleX(i, data.length, box)),
    y: r2(scaleY(v, min, max, box)),
  }))
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
  const last = pts[pts.length - 1]
  const area = `${line} L${last.x},${height} L${pts[0].x},${height} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel ?? "Trend sparkline"}
      className={cn("block", className)}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--chart-1)", stopOpacity: 0.4 }} />
          <stop offset="1" style={{ stopColor: "var(--chart-1)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        style={{ stroke: "var(--gold-300)" }}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={last.x}
        cy={last.y}
        r={3}
        style={{ fill: "var(--gold-300)", stroke: "var(--background)" }}
        strokeWidth={1.5}
      />
    </svg>
  )
}
