import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "text-card-foreground flex flex-col gap-4 rounded-[10px] border",
  {
    variants: {
      variant: {
        default: "bg-surface-0 border-border shadow-[var(--sh-sm)]",
        elevated: "bg-surface-2 border-border shadow-[var(--sh-sm)]",
        highlighted: "bg-surface-0 border-border-accent shadow-[var(--shadow-gold-sm)]",
        interactive:
          "bg-surface-2 border-border shadow-[var(--sh-sm)] hover:border-border-strong hover:shadow-[var(--sh-md)] cursor-pointer transition-all duration-[var(--dur-std)] ease-[var(--ease-out)]",
        featured:
          "relative isolate overflow-hidden bg-surface-0 border-gold-400/[0.28] shadow-[var(--sh-gold)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-0.5 before:bg-gradient-to-r before:from-gold-300 before:to-gold-500 after:content-[''] after:absolute after:inset-0 after:-z-10 after:bg-gradient-to-b after:from-gold-400/[0.07] after:to-transparent after:to-[52%]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Card({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 p-6 pb-4 border-b border-border-subtle has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold text-[20px] tracking-tight", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6 pb-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 pb-6 pt-0", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  cardVariants,
}
