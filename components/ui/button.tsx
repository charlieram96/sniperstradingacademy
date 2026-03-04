import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] text-sm font-medium cursor-pointer transition-all duration-150 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-gold-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gold-400 text-primary-foreground font-semibold shadow-sm hover:bg-gold-300 hover:shadow-[var(--shadow-gold-sm)] hover:-translate-y-px active:bg-gold-500",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md",
        outline:
          "border border-border bg-transparent hover:bg-surface-3 hover:border-border-strong text-foreground",
        premium:
          "border border-border-accent bg-transparent text-gold-400 hover:bg-gold-400/10 hover:border-border-interactive font-semibold",
        secondary:
          "bg-surface-2 text-secondary-foreground border border-border hover:bg-surface-3",
        ghost:
          "hover:bg-white/[0.06] hover:text-foreground",
        link: "text-gold-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-[6px] gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-10 rounded-[6px] px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
