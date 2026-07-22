import * as React from "react"
import { cn } from "@/lib/utils"
import { Sparkline } from "@/components/charts/sparkline"

interface StatTileProps {
  label: string
  value: React.ReactNode
  /** Delta magnitude, e.g. `"8.3%"`. Rendered in a ▲/▼ chip. */
  delta?: string
  deltaDirection?: "up" | "down"
  sparklineData?: number[]
  footnote?: string
  /**
   * Value emphasis. `"default"` renders the figure in ink (app-signatures §01
   * default tile); `"gold"` opts into the gold-100 lead treatment reserved for
   * a single hero figure per row.
   */
  tone?: "default" | "gold"
  className?: string
}

/**
 * Reference stat tile (cards.html · 04): mono uppercase label, one gold
 * tabular figure, an optional sanctioned delta chip, footnote and sparkline.
 */
export function StatTile({
  label,
  value,
  delta,
  deltaDirection = "up",
  sparklineData,
  footnote,
  tone = "default",
  className,
}: StatTileProps) {
  const up = deltaDirection === "up"
  return (
    <div
      className={cn(
        "flex min-h-[150px] flex-col rounded-[10px] border border-border bg-surface-0 p-5 shadow-[var(--sh-sm)]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-tertiary">
          {label}
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-[7px] py-0.5 font-mono text-[11px] font-semibold tabular-nums",
              up
                ? "border-emerald/20 bg-emerald-dim text-emerald"
                : "border-red/20 bg-red-dim text-red"
            )}
          >
            {up ? "▲" : "▼"} {delta}
          </span>
        )}
      </div>

      <div
        className={cn(
          "mt-3.5 font-mono text-[26px] font-semibold leading-none tracking-tight tabular-nums",
          tone === "gold" ? "text-gold-100" : "text-foreground"
        )}
      >
        {value}
      </div>

      {(footnote || sparklineData) && (
        <div className="mt-auto flex items-end justify-between gap-2.5 pt-3.5">
          {footnote && (
            <span className="font-mono text-[10px] tabular-nums text-foreground-tertiary">
              {footnote}
            </span>
          )}
          {sparklineData && (
            <Sparkline
              data={sparklineData}
              width={120}
              height={40}
              className="ml-auto h-10 w-[120px]"
              aria-label={`${label} trend`}
            />
          )}
        </div>
      )}
    </div>
  )
}
