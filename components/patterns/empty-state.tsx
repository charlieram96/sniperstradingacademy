import * as React from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  /** A single clear next step — typically a Button. */
  action?: React.ReactNode
  className?: string
}

/**
 * Empty state (states.html · 01): icon, one line, one clear step. Centered on a
 * resting card surface.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[250px] flex-col items-center justify-center gap-3 rounded-[10px] border border-border bg-surface-0 px-[26px] pt-9 pb-[30px] text-center",
        className
      )}
    >
      <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[10px] border border-border bg-surface-2 text-foreground-tertiary [&_svg]:h-6 [&_svg]:w-6">
        {icon}
      </span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="max-w-[210px] text-xs leading-relaxed tabular-nums text-foreground-secondary">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
