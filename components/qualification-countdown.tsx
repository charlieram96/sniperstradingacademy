"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { 
  Trophy, 
  Users, 
  Clock,
  AlertTriangle,
  CheckCircle,
  Lock,
  Unlock
} from "lucide-react"

interface QualificationCountdownProps {
  activatedAt: Date | null
  qualificationDeadline: Date | null
  qualifiedAt: Date | null
  directReferralsCount: number
  accumulatedResidual: number
  onShareReferralLink?: () => void
}

export function QualificationCountdown({
  activatedAt,
  qualificationDeadline,
  qualifiedAt,
  directReferralsCount,
  accumulatedResidual,
  onShareReferralLink
}: QualificationCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
    totalDays: number
    isExpired: boolean
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalDays: 365,
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
          minutes: 0,
          seconds: 0,
          totalDays: 0,
          isExpired: true
        })
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      // Calculate total days elapsed
      const startDate = activatedAt ? new Date(activatedAt) : now
      const totalElapsed = now.getTime() - startDate.getTime()
      const daysElapsed = Math.floor(totalElapsed / (1000 * 60 * 60 * 24))
      const totalDays = 365 - daysElapsed

      setTimeRemaining({
        days,
        hours,
        minutes,
        seconds,
        totalDays,
        isExpired: false
      })
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000) // Update every second

    return () => clearInterval(interval)
  }, [qualificationDeadline, qualifiedAt, activatedAt])

  const daysProgressPercentage = ((365 - timeRemaining.totalDays) / 365) * 100

  if (qualifiedAt) {
    return (
      <Card className="border-2 border-green-500/20 bg-green-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-green-500" />
              <CardTitle className="text-xl">Fully Qualified!</CardTitle>
            </div>
            <Badge className="bg-green-500 text-white">
              <CheckCircle className="h-3 w-3 mr-1" />
              Qualified
            </Badge>
          </div>
          <CardDescription className="text-base mt-2">
            Congratulations! You&apos;ve unlocked permanent residual income from your team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-background rounded-lg">
              <Users className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{directReferralsCount}</p>
              <p className="text-sm text-muted-foreground">Direct Referrals</p>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <Unlock className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">${accumulatedResidual}</p>
              <p className="text-sm text-muted-foreground">Residual Unlocked</p>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-lg font-bold">
                {qualifiedAt ? new Date(qualifiedAt).toLocaleDateString() : ""}
              </p>
              <p className="text-sm text-muted-foreground">Qualified Date</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (timeRemaining.isExpired) {
    return (
      <Card className="border-2 border-red-500/20 bg-red-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <CardTitle className="text-xl">Qualification Period Expired</CardTitle>
            </div>
            <Badge variant="destructive">Expired</Badge>
          </div>
          <CardDescription className="text-base mt-2 text-red-500">
            Your 365-day qualification period has ended. Your accumulated residual of ${accumulatedResidual} has been forfeited.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-sm font-medium text-red-500">What this means:</p>
            <ul className="text-sm text-red-500/80 mt-2 space-y-1 list-disc list-inside">
              <li>Your accumulated residual earnings have been reset to $0</li>
              <li>You needed {3 - directReferralsCount} more referral{3 - directReferralsCount !== 1 ? 's' : ''} to qualify</li>
              <li>Future residual earnings will continue to accumulate</li>
              <li>Contact support for more information</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!activatedAt) {
    return (
      <Card className="border-2 border-muted">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <CardTitle className="text-xl">Account Not Activated</CardTitle>
          </div>
          <CardDescription className="text-base mt-2">
            Pay your $500 activation fee to start your 365-day qualification period.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const urgencyLevel = timeRemaining.days <= 7 ? 'critical' : 
                       timeRemaining.days <= 30 ? 'warning' : 
                       timeRemaining.days <= 90 ? 'caution' : 'normal'

  const urgencyColors = {
    critical: 'border-red-500/20 bg-red-500/5',
    warning: 'border-amber-500/20 bg-amber-500/5',
    caution: 'border-yellow-500/20 bg-yellow-500/5',
    normal: 'border-primary/20 bg-primary/5'
  }

  return (
    <Card className={`border-2 ${urgencyColors[urgencyLevel]}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl">Qualification Countdown</CardTitle>
          </div>
          <Badge 
            variant={urgencyLevel === 'critical' ? 'destructive' : 
                    urgencyLevel === 'warning' ? 'default' : 'outline'}
            className={urgencyLevel === 'warning' ? 'bg-amber-500' : ''}
          >
            {timeRemaining.days} days left
          </Badge>
        </div>
        <CardDescription className="text-base mt-2">
          Get 3 direct referrals within 365 days to permanently unlock your residual income
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Countdown Timer */}
        <div className="grid grid-cols-4 gap-2 md:gap-4">
          <div className="text-center p-3 bg-background rounded-lg border">
            <p className="text-2xl md:text-3xl font-bold text-primary">{timeRemaining.days}</p>
            <p className="text-xs text-muted-foreground">Days</p>
          </div>
          <div className="text-center p-3 bg-background rounded-lg border">
            <p className="text-2xl md:text-3xl font-bold text-primary">{timeRemaining.hours}</p>
            <p className="text-xs text-muted-foreground">Hours</p>
          </div>
          <div className="text-center p-3 bg-background rounded-lg border">
            <p className="text-2xl md:text-3xl font-bold text-primary">{timeRemaining.minutes}</p>
            <p className="text-xs text-muted-foreground">Minutes</p>
          </div>
          <div className="text-center p-3 bg-background rounded-lg border">
            <p className="text-2xl md:text-3xl font-bold text-primary">{timeRemaining.seconds}</p>
            <p className="text-xs text-muted-foreground">Seconds</p>
          </div>
        </div>

        {/* Progress Section */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Direct Referrals Progress
              </span>
              <span className="text-sm font-bold">{directReferralsCount} / 3</span>
            </div>
            <Progress value={(directReferralsCount / 3) * 100} className="h-3" />
            <p className="text-xs text-muted-foreground mt-1">
              {3 - directReferralsCount} more referral{3 - directReferralsCount !== 1 ? 's' : ''} needed
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time Elapsed
              </span>
              <span className="text-sm font-bold">{365 - timeRemaining.totalDays} / 365 days</span>
            </div>
            <Progress value={daysProgressPercentage} className="h-3" />
          </div>
        </div>

        {/* Accumulated Residual */}
        <div className="bg-background rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium">Accumulated Residual</p>
                <p className="text-xs text-muted-foreground">Unlocks when qualified</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-amber-500">${accumulatedResidual}</p>
              <p className="text-xs text-muted-foreground">On hold</p>
            </div>
          </div>
        </div>

        {/* Warning Messages */}
        {urgencyLevel === 'critical' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-sm font-medium text-red-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Critical: Less than 7 days remaining!
            </p>
            <p className="text-xs text-red-500/80 mt-1">
              You&apos;re at risk of losing ${accumulatedResidual} in accumulated residual. 
              Share your referral link now!
            </p>
          </div>
        )}

        {urgencyLevel === 'warning' && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-sm font-medium text-amber-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Warning: Less than 30 days remaining!
            </p>
            <p className="text-xs text-amber-500/80 mt-1">
              Time is running out to secure your residual income. You need {3 - directReferralsCount} more referral{3 - directReferralsCount !== 1 ? 's' : ''}.
            </p>
          </div>
        )}

        {/* Call to Action */}
        <Button 
          onClick={onShareReferralLink}
          className="w-full"
          size="lg"
        >
          <Users className="h-4 w-4 mr-2" />
          Share Referral Link ({3 - directReferralsCount} needed)
        </Button>

        {/* Info Section */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p>• Get 3 direct referrals to permanently unlock residual income</p>
          <p>• Your accumulated residual will be released once qualified</p>
          <p>• If time expires, accumulated residual will be forfeited</p>
        </div>
      </CardContent>
    </Card>
  )
}