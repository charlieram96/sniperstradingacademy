import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface PageHeaderProps {
  title: string
  description?: string
  badge?: string
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, badge, action, className }: PageHeaderProps) {
  return (
    <div className={cn("pb-6 mb-6 border-b border-border-subtle", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-[32px] font-semibold tracking-tight text-foreground">{title}</h1>
            {badge && <Badge variant="default">{badge}</Badge>}
          </div>
          {description && (
            <p className="text-sm text-foreground-secondary">{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  )
}
