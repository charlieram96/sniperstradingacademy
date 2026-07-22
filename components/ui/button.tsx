import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-[6px] border border-transparent font-semibold tracking-[0.01em] leading-none cursor-pointer outline-none transition-colors duration-[var(--dur-micro)] ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 shrink-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-gold-400 text-primary-foreground hover:bg-gold-300",
        destructive:
          "bg-red-dim text-red border-red/30 hover:bg-red/[0.22]",
        outline:
          "bg-transparent text-foreground-secondary border-border hover:text-foreground hover:border-border-strong",
        premium:
          "bg-transparent text-gold-400 border-border-accent hover:bg-gold-400/10 hover:border-border-interactive",
        secondary:
          "bg-surface-2 text-foreground border-border hover:bg-surface-overlay hover:border-border-strong",
        ghost:
          "text-foreground-secondary hover:bg-white/5 hover:text-foreground",
        link: "text-gold-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[34px] px-4 text-[12.5px]",
        sm: "h-7 px-3 text-[11.5px]",
        lg: "h-10 px-5 text-sm",
        icon: "size-[34px] p-0",
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
