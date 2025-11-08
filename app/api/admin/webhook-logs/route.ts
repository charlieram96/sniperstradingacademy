import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  try {
    // Verify superadmin authentication
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user is superadmin
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single()

    if (userData?.role !== "superadmin") {
      return NextResponse.json(
        { error: "Access denied. Superadmin only." },
        { status: 403 }
      )
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const status = searchParams.get("status") // 'processed', 'failed', 'pending'
    const eventType = searchParams.get("eventType")
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from("webhook_events")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status === "processed") {
      query = query.eq("processed", true)
    } else if (status === "failed") {
      query = query.eq("processed", false).gt("processing_attempts", 1)
    } else if (status === "pending") {
      query = query.eq("processed", false).eq("processing_attempts", 1)
    }

    if (eventType) {
      query = query.eq("event_type", eventType)
    }

    const { data: webhooks, error: webhookError, count } = await query

    if (webhookError) {
      console.error("Error fetching webhooks:", webhookError)
      return NextResponse.json(
        { error: "Failed to fetch webhook logs" },
        { status: 500 }
      )
    }

    // Get statistics for the dashboard with proper error handling
    const { data: stats, error: statsError } = await supabase
      .from("webhook_events")
      .select("processed, processing_attempts, created_at")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (statsError) {
      console.error("Error fetching stats:", statsError)
    }

    const statistics = {
      total24h: stats?.length || 0,
      processed: stats?.filter(s => s.processed).length || 0,
      failed: stats?.filter(s => !s.processed && s.processing_attempts > 1).length || 0,
      pending: stats?.filter(s => !s.processed && s.processing_attempts === 1).length || 0
    }

    // Get event type breakdown
    const { data: eventTypes, error: eventTypesError } = await supabase
      .from("webhook_events")
      .select("event_type")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (eventTypesError) {
      console.error("Error fetching event types:", eventTypesError)
    }

    const eventTypeCount = eventTypes?.reduce((acc, e) => {
      acc[e.event_type] = (acc[e.event_type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Extract user information from webhook payloads
    const webhooksWithUsers = await Promise.all(
      (webhooks || []).map(async (webhook) => {
        let userId: string | null = null
        let userEmail: string | null = null
        let userName: string | null = null

        // Extract user ID from payload based on event type
        try {
          const payload = webhook.payload as {
            data?: {
              object?: {
                metadata?: { userId?: string }
                customer?: string
                account?: string
              }
            }
          }

          // Try different paths to find user information
          if (payload?.data?.object?.metadata?.userId) {
            userId = payload.data.object.metadata.userId
          } else if (payload?.data?.object?.customer) {
            // For customer-related events, we have a stripe_customer_id
            const stripeCustomerId = payload.data.object.customer

            // Look up user by stripe_customer_id
            const { data: user } = await supabase
              .from("users")
              .select("id, email, name")
              .eq("stripe_customer_id", stripeCustomerId)
              .single()

            if (user) {
              userId = user.id
              userEmail = user.email
              userName = user.name
            }
          } else if (payload?.data?.object?.account) {
            // For connect account events
            const stripeAccountId = payload.data.object.account

            const { data: user } = await supabase
              .from("users")
              .select("id, email, name")
              .eq("stripe_connect_account_id", stripeAccountId)
              .single()

            if (user) {
              userId = user.id
              userEmail = user.email
              userName = user.name
            }
          }

          // If we found a userId but no email/name, fetch it
          if (userId && !userEmail) {
            const { data: user } = await supabase
              .from("users")
              .select("email, name")
              .eq("id", userId)
              .single()

            if (user) {
              userEmail = user.email
              userName = user.name
            }
          }
        } catch (error) {
          console.error("Error extracting user info:", error)
        }

        return {
          ...webhook,
          user_id: userId,
          user_email: userEmail,
          user_name: userName
        }
      })
    )

    return NextResponse.json({
      webhooks: webhooksWithUsers,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      statistics,
      eventTypes: eventTypeCount || {}
    })

  } catch (error) {
    console.error("Webhook logs API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
