"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Clock, 
  Users,
  AlertTriangle,
  CheckCircle,
  Lock
} from "lucide-react"
import Link from "next/link"

interface QualificationCountdownWidgetProps {
  activatedAt: Date | null
  qualificationDeadline: Date | null
  qualifiedAt: Date | null
  directReferralsCount: number
  accumulatedResidual: number
}

export function QualificationCountdownWidget({
  activatedAt,
  qualificationDeadline,
  qualifiedAt,
  directReferralsCount,
  accumulatedResidual
}: QualificationCountdownWidgetProps) {
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number
    hours: number
    isExpired: boolean
  }>({
    days: 0,
    hours: 0,
    isExpired: false
  })

  useEffect(() => {
    const updateCountdown = () => {
      if (!qualificationDeadline || qualifiedAt) {
        return
      }

      const now = new Date()
      const deadline = new Date(qualificationDeadline)
      const diff = deadline.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeRemaining({
          days: 0,
          hours: 0,
          isExpired: true
        })
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

      setTimeRemaining({
        days,
        hours,
        isExpired: false
      })
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [qualificationDeadline, qualifiedAt])

  if (qualifiedAt) {
    return (
      <Link href="/finance">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-green-500/20 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="font-semibold">Fully Qualified</p>
                  <p className="text-sm text-muted-foreground">Residual income unlocked</p>
                </div>
              </div>
              <Badge className="bg-green-500">
                ${accumulatedResidual}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  if (timeRemaining.isExpired) {
    return (
      <Link href="/finance">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-red-500/20 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="font-semibold text-red-500">Qualification Expired</p>
                  <p className="text-sm text-red-500/80">${accumulatedResidual} forfeited</p>
                </div>
              </div>
              <Badge variant="destructive">Expired</Badge>
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  if (!activatedAt) {
    return (
      <Link href="/finance">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Lock className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-semibold">Not Activated</p>
                <p className="text-sm text-muted-foreground">Pay $500 to start qualification</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  const urgencyLevel = timeRemaining.days <= 7 ? 'critical' : 
                       timeRemaining.days <= 30 ? 'warning' : 'normal'

  const borderColor = urgencyLevel === 'critical' ? 'border-red-500/20' :
                      urgencyLevel === 'warning' ? 'border-amber-500/20' : ''
  
  const bgColor = urgencyLevel === 'critical' ? 'bg-red-500/5' :
                  urgencyLevel === 'warning' ? 'bg-amber-500/5' : ''

  return (
    <Link href="/finance">
      <Card className={`hover:shadow-lg transition-shadow cursor-pointer ${borderColor} ${bgColor}`}>
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="font-semibold">Qualification Period</span>
              </div>
              <Badge 
                variant={urgencyLevel === 'critical' ? 'destructive' : 
                        urgencyLevel === 'warning' ? 'default' : 'outline'}
                className={urgencyLevel === 'warning' ? 'bg-amber-500' : ''}
              >
                {timeRemaining.days}d {timeRemaining.hours}h
              </Badge>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Referrals
                </span>
                <span className="font-medium">{directReferralsCount}/3</span>
              </div>
              <Progress value={(directReferralsCount / 3) * 100} className="h-2" />
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="text-muted-foreground">Accumulated</p>
                <p className="font-bold text-lg">${accumulatedResidual}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Need</p>
                <p className="font-bold">{3 - directReferralsCount} more</p>
              </div>
            </div>

            {/* Warning */}
            {urgencyLevel !== 'normal' && (
              <div className="flex items-center gap-2 text-xs">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                <span className="text-amber-500">
                  {urgencyLevel === 'critical' ? 'Less than 7 days!' : 'Time running out'}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}