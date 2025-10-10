"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Calendar, DollarSign, CheckCircle2 } from "lucide-react"

interface PaymentScheduleSelectorProps {
  value: "weekly" | "monthly"
  onChange: (value: "weekly" | "monthly") => void
}

export function PaymentScheduleSelector({ value, onChange }: PaymentScheduleSelectorProps) {
  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>Choose Your Payment Schedule</CardTitle>
        <CardDescription>
          Select how often you&apos;d like to be billed. Both options total $199/month.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={value} onValueChange={(val) => onChange(val as "weekly" | "monthly")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Weekly Option */}
            <div
              className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:border-primary ${
                value === 'weekly' ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onClick={() => onChange('weekly')}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value="weekly" id="weekly" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="weekly" className="cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold">Weekly</span>
                      <Badge variant="secondary" className="text-xs">Smaller Payments</Badge>
                    </div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-3xl font-bold text-primary">49.75</span>
                      <span className="text-sm text-muted-foreground">/week</span>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">Easier on your budget</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">Billed every 7 days</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">Total: ~$199/month</span>
                      </li>
                    </ul>
                  </Label>
                </div>
              </div>
            </div>

            {/* Monthly Option */}
            <div
              className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:border-primary ${
                value === 'monthly' ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onClick={() => onChange('monthly')}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value="monthly" id="monthly" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="monthly" className="cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold">Monthly</span>
                      <Badge variant="secondary" className="text-xs">Most Popular</Badge>
                    </div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-3xl font-bold text-primary">199</span>
                      <span className="text-sm text-muted-foreground">/month</span>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">One payment per month</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">Billed every 30 days</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">Simpler to manage</span>
                      </li>
                    </ul>
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </RadioGroup>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">Total Cost</p>
              <p className="text-muted-foreground">
                Both payment schedules cost the same amount: <strong>$199 per month</strong>.
                Choose the schedule that works best for your budget.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
