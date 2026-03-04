import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-4", className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <div className="mt-1.5 w-8 h-0.5 bg-gradient-to-r from-gold-400 to-transparent rounded-full" />
          {description && (
            <p className="mt-1.5 text-sm text-foreground-secondary">{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  )
}
