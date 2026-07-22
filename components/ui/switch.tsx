"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-gold-400/[0.22] data-[state=checked]:border-gold-400/45 data-[state=unchecked]:bg-surface-2 focus-visible:ring-ring inline-flex h-[22px] w-10 shrink-0 items-center rounded-full border border-border transition-colors duration-[var(--dur-std)] ease-[var(--ease-out)] outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-foreground-tertiary data-[state=checked]:bg-gold-300 pointer-events-none block size-4 rounded-full ring-0 transition-transform duration-[var(--dur-std)] ease-[var(--ease-out)] data-[state=checked]:translate-x-[20px] data-[state=unchecked]:translate-x-[2px]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
