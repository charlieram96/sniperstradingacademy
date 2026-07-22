import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Canonical shimmer block (states.html · 02): a `--surface-2` rectangle whose
 * `::after` runs the shared `animate-shimmer` sweep (globals.css). All loading
 * placeholders compose from this one primitive.
 */
export function Skeleton({ className, style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-shimmer rounded-[5px] bg-surface-2", className)}
      style={style}
      {...props}
    />
  )
}

/** Stat-tile loading composition: label, value and delta-chip placeholders. */
export function SkeletonTile({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[150px] flex-col gap-3.5 rounded-[10px] border border-border bg-surface-0 p-5",
        className
      )}
    >
      <Skeleton className="h-[9px] w-[44%]" />
      <Skeleton className="h-[26px] w-[70%]" />
      <Skeleton className="h-[18px] w-[34%] rounded-md" />
    </div>
  )
}

/** `n` table-row placeholders: avatar, name and two trailing figures. */
export function SkeletonRows({ n = 3, className }: { n?: number; className?: string }) {
  const widths = ["32%", "26%", "36%", "30%", "28%", "34%"]
  return (
    <div className={cn("flex flex-col", className)}>
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3.5 border-b border-border-subtle py-3.5 last:border-b-0"
        >
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          <Skeleton className="h-2.5" style={{ width: widths[i % widths.length] }} />
          <Skeleton className="ml-auto h-2.5 w-[16%]" />
          <Skeleton className="h-2.5 w-[18%]" />
        </div>
      ))}
    </div>
  )
}

/**
 * Class-row loading composition (app-signatures §02): a date/time column, a
 * title + meta + badge body, and a right-aligned CTA — the row-list anatomy.
 */
export function SkeletonClassRow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-[10px] border border-border bg-surface-0 p-4",
        className
      )}
    >
      <div className="flex shrink-0 flex-col items-center gap-1.5 border-r border-border pr-4">
        <Skeleton className="h-5 w-6" />
        <Skeleton className="h-2 w-6" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-[13px] w-[52%]" />
        <Skeleton className="h-2.5 w-[36%]" />
        <Skeleton className="mt-0.5 h-[18px] w-16 rounded-md" />
      </div>
      <Skeleton className="h-[34px] w-24 shrink-0 rounded-md" />
    </div>
  )
}

/** Class-card loading composition: media block, title, meta and a CTA. */
export function SkeletonClassCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[10px] border border-border bg-surface-0 p-[18px]",
        className
      )}
    >
      <Skeleton className="h-[92px] rounded-lg" />
      <Skeleton className="h-[13px] w-[74%]" />
      <Skeleton className="h-2.5 w-[48%]" />
      <Skeleton className="mt-0.5 h-[30px] w-24 rounded-md" />
    </div>
  )
}
