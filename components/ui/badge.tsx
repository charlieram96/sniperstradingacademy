import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[4px] px-2 py-0.5 text-[11px] uppercase tracking-wide font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-gold-400/12 text-gold-300 [a&]:hover:bg-gold-400/20",
        secondary:
          "bg-surface-3 text-foreground-secondary [a&]:hover:bg-surface-4",
        destructive:
          "bg-red-500/12 text-red-400 [a&]:hover:bg-red-500/20",
        success:
          "bg-emerald-500/12 text-emerald-400 [a&]:hover:bg-emerald-500/20",
        info:
          "bg-blue-500/12 text-blue-400 [a&]:hover:bg-blue-500/20",
        outline:
          "border border-border text-foreground-secondary [a&]:hover:bg-surface-3",
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
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
