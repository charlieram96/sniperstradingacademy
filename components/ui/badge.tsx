import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1.5 w-fit shrink-0 whitespace-nowrap overflow-hidden rounded-[5px] border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] [&>svg]:size-2.5 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-[color,box-shadow]",
  {
    variants: {
      variant: {
        default:
          "border-gold-400/30 bg-gold-400/10 text-gold-300 [a&]:hover:bg-gold-400/16",
        secondary:
          "border-border bg-surface-2 text-foreground-secondary [a&]:hover:bg-surface-4",
        destructive:
          "border-red/30 bg-red-dim text-red [a&]:hover:bg-red/20",
        success:
          "border-emerald/28 bg-emerald-dim text-emerald [a&]:hover:bg-emerald/20",
        info:
          "border-blue-400/30 bg-blue-dim text-blue-400 [a&]:hover:bg-blue-400/20",
        warning:
          "border-amber/28 bg-amber-dim text-amber [a&]:hover:bg-amber/20",
        outline:
          "border-border bg-transparent text-foreground-secondary [a&]:hover:bg-surface-2",
        live:
          "border-red/30 bg-red/[0.07] text-red",
        gold:
          "border-gold-400/28 bg-gold-400/10 text-gold-400 [a&]:hover:bg-gold-400/16",
        locked:
          "border-border bg-transparent text-foreground-tertiary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"
  const showLiveDot = !asChild && variant === "live"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {showLiveDot ? (
        <>
          <span className="relative flex size-[5px] shrink-0">
            <span className="absolute inline-flex size-full rounded-full bg-red opacity-60 animate-[ping_2s_ease-out_infinite]" />
            <span className="relative inline-flex size-[5px] rounded-full bg-red" />
          </span>
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Badge, badgeVariants }
