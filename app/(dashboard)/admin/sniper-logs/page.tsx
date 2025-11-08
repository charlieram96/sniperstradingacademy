"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Copy,
  Info
} from "lucide-react"

// Webhook event type descriptions
const WEBHOOK_DESCRIPTIONS: Record<string, string> = {
  "checkout.session.completed": "Payment checkout completed - Initial payment or subscription created",
  "customer.subscription.created": "New subscription created for a customer",
  "customer.subscription.updated": "Subscription status or details changed",
  "customer.subscription.deleted": "Subscription cancelled or expired",
  "invoice.payment_succeeded": "Recurring payment succeeded (weekly/monthly)",
  "invoice.payment_failed": "Recurring payment failed",
  "invoice.created": "New invoice created for upcoming payment",
  "invoice.finalized": "Invoice finalized and ready for payment",
  "payment_intent.succeeded": "Payment successfully completed",
  "payment_intent.payment_failed": "Payment attempt failed",
  "payment_intent.created": "New payment intent created",
  "payout.paid": "Commission payout completed to user's bank",
  "payout.failed": "Payout to user's bank failed",
  "payout.created": "New payout initiated",
  "charge.succeeded": "One-time charge succeeded",
  "charge.failed": "One-time charge failed",
  "charge.refunded": "Payment refunded to customer",
  "charge.dispute.created": "Customer initiated a chargeback/dispute",
  "charge.dispute.closed": "Dispute resolved",
  "account.updated": "Stripe Connect account information updated",
  "account.application.deauthorized": "User disconnected their Stripe account",
  "account.external_account.created": "Bank account added to Stripe Connect",
  "account.external_account.updated": "Bank account details updated",
  "account.external_account.deleted": "Bank account removed from Stripe Connect",
  "customer.created": "New Stripe customer created",
  "customer.updated": "Customer information updated",
  "customer.deleted": "Customer deleted from Stripe"
}

interface WebhookEvent {
  id: string
  stripe_event_id: string
  event_type: string
  payload: Record<string, unknown>
  processed: boolean
  processing_attempts: number
  last_error: string | null
  last_attempt_at: string | null
  created_at: string
  processed_at: string | null
  user_id?: string | null
  user_email?: string | null
  user_name?: string | null
}

interface Statistics {
  total24h: number
  processed: number
  failed: number
  pending: number
}

interface WebhookLogsResponse {
  webhooks: WebhookEvent[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  statistics: Statistics
  eventTypes: Record<string, number>
}

export default function SniperLogsPage() {
  const [data, setData] = useState<WebhookLogsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all")

  const fetchWebhooks = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50"
      })

      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }

      if (eventTypeFilter !== "all") {
        params.append("eventType", eventTypeFilter)
      }

      const response = await fetch(`/api/admin/webhook-logs?${params}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error("Error fetching webhook logs:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWebhooks()
  }, [page, statusFilter, eventTypeFilter])

  const getStatusBadge = (event: WebhookEvent) => {
    if (event.processed) {
      return (
        <Badge className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Processed
        </Badge>
      )
    } else if (event.processing_attempts > 1) {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      )
    } else {
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      )
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const getEventDescription = (eventType: string) => {
    return WEBHOOK_DESCRIPTIONS[eventType] || "Stripe webhook event"
  }

  const successRate = data?.statistics.total24h
    ? Math.round((data.statistics.processed / data.statistics.total24h) * 100)
    : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Sniper Logs</h1>
        <p className="text-muted-foreground mt-2">
          Monitor Stripe webhook events and processing status
        </p>
      </div>

      {/* Statistics Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                <span className="text-3xl font-bold">{data.statistics.total24h}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Processed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-3xl font-bold">{data.statistics.processed}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {successRate}% success rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="text-3xl font-bold">{data.statistics.failed}</span>
              </div>
              {data.statistics.failed > 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Requires attention
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <span className="text-3xl font-bold">{data.statistics.pending}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Webhook Events</CardTitle>
              <CardDescription>
                {data && `Showing ${data.webhooks.length} of ${data.pagination.total} events`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Filter by event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Event Types</SelectItem>
                  {data && Object.keys(data.eventTypes).map(type => (
                    <SelectItem key={type} value={type}>
                      {type} ({data.eventTypes[type]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchWebhooks}
                disabled={loading}
              >
                {loading ? "Loading..." : "Refresh"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading webhook events...</p>
            </div>
          ) : data && data.webhooks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No webhook events found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <TooltipProvider>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Event Type</th>
                      <th className="text-left p-3 font-medium">User</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Stripe ID</th>
                      <th className="text-left p-3 font-medium">Attempts</th>
                      <th className="text-left p-3 font-medium">Created</th>
                      <th className="text-left p-3 font-medium">Error</th>
                      <th className="text-left p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.webhooks.map((event) => (
                      <tr
                        key={event.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {event.event_type}
                            </code>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">{getEventDescription(event.event_type)}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                        <td className="p-3">
                          {event.user_email ? (
                            <div className="text-xs">
                              <div className="font-medium">{event.user_name || "Unknown"}</div>
                              <div className="text-muted-foreground">{event.user_email}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3">{getStatusBadge(event)}</td>
                        <td className="p-3">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 cursor-pointer">
                                <span className="text-sm font-mono text-muted-foreground">
                                  {event.stripe_event_id.substring(0, 20)}...
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => copyToClipboard(event.stripe_event_id)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-mono text-xs">{event.stripe_event_id}</p>
                              <p className="text-xs text-muted-foreground mt-1">Click copy to clipboard</p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            {event.processing_attempts > 1 && (
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            )}
                            <span className="text-sm">{event.processing_attempts}</span>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {formatDate(event.created_at)}
                        </td>
                        <td className="p-3">
                          {event.last_error ? (
                            <span className="text-xs text-red-500 truncate max-w-[200px] block">
                              {event.last_error}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEvent(event)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TooltipProvider>
            </div>
          )}

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= data.pagination.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Webhook Event Details</DialogTitle>
            <DialogDescription>
              {selectedEvent && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{selectedEvent.stripe_event_id}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => copyToClipboard(selectedEvent.stripe_event_id)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getEventDescription(selectedEvent.event_type)}
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Event Type</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block mt-1">
                    {selectedEvent.event_type}
                  </code>
                </div>
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedEvent)}</div>
                </div>
                {selectedEvent.user_email && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium">User</p>
                    <div className="text-sm mt-1">
                      <div className="font-medium">{selectedEvent.user_name || "Unknown"}</div>
                      <div className="text-muted-foreground">{selectedEvent.user_email}</div>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">Processing Attempts</p>
                  <p className="text-sm mt-1">{selectedEvent.processing_attempts}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Created At</p>
                  <p className="text-sm mt-1">{formatDate(selectedEvent.created_at)}</p>
                </div>
              </div>

              {selectedEvent.last_error && (
                <div>
                  <p className="text-sm font-medium text-red-500">Error Message</p>
                  <div className="bg-red-50 border border-red-200 rounded p-3 mt-2">
                    <code className="text-xs text-red-700">{selectedEvent.last_error}</code>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Webhook Payload</p>
                <div className="bg-muted rounded p-3 overflow-x-auto">
                  <pre className="text-xs">
                    {JSON.stringify(selectedEvent.payload, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
