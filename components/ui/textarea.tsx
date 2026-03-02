import * as React from "react"

import { cn } from "@/lib/utils"

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-[6px] border border-border bg-surface-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-gold-400 focus-visible:ring-2 focus-visible:ring-gold-400/20 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
