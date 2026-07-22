import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground bg-surface-2 text-foreground border-border h-[38px] w-full min-w-0 rounded-[6px] border px-3 text-sm transition-colors duration-[var(--dur-micro)] ease-[var(--ease-out)] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-gold-400 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "aria-invalid:border-red aria-invalid:ring-red/20 aria-invalid:focus-visible:border-red",
        className
      )}
      {...props}
    />
  )
}

export { Input }
