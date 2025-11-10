/**
 * SEND MANUAL NOTIFICATION API
 *
 * Allows superadmins to send custom messages to selected users
 * Uses 'admin_announcement' notification type
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendNotification } from "@/lib/notifications/notification-service"
import type { NotificationChannel } from "@/lib/notifications/notification-types"

interface SendManualRequest {
  userIds: string[]
  subject?: string // For email
  message: string
  channels: NotificationChannel[]
}

export async function POST(request: NextRequest) {
  try {
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
      .select("role, name")
      .eq("id", authUser.id)
      .single()

    if (userData?.role !== "superadmin") {
      return NextResponse.json(
        { error: "Access denied. Superadmin only." },
        { status: 403 }
      )
    }

    const body = await request.json() as SendManualRequest
    const { userIds, subject, message, channels } = body

    // Validate input
    if (!userIds || userIds.length === 0) {
      return NextResponse.json(
        { error: "At least one user must be selected" },
        { status: 400 }
      )
    }

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      )
    }

    if (!channels || channels.length === 0) {
      return NextResponse.json(
        { error: "At least one channel must be selected" },
        { status: 400 }
      )
    }

    // Validate channels
    const validChannels: NotificationChannel[] = ['email', 'sms']
    for (const channel of channels) {
      if (!validChannels.includes(channel)) {
        return NextResponse.json(
          { error: `Invalid channel: ${channel}` },
          { status: 400 }
        )
      }
    }

    // Limit to prevent abuse
    if (userIds.length > 1000) {
      return NextResponse.json(
        { error: "Cannot send to more than 1000 users at once" },
        { status: 400 }
      )
    }

    // Send notifications to each user SEQUENTIALLY
    // Sequential sending prevents parallel DNS resolution and reuses Redis connection
    const results: Array<{ userId: string; result: Array<{success: boolean; error?: string; status: string; channel: string}> }> = []

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i]

      try {
        const result = await sendNotification({
          userId,
          type: 'admin_announcement',
          channel: channels,
          data: {
            subject: subject || 'Message from Admin',
            message: message.trim(),
            eventId: `manual_${authUser.id}_${Date.now()}_${userId}`,
            senderName: userData.name || 'Admin'
          }
        })
        results.push({ userId, result })
      } catch (error) {
        console.error(`Error sending to user ${userId}:`, error)
        results.push({
          userId,
          result: [{
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'failed' as const,
            channel: 'email' as const
          }]
        })
      }

      // Add small delay between sends to prevent overwhelming Redis/DNS
      // Skip delay for last user
      if (i < userIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100)) // 100ms delay
      }
    }

    // Calculate statistics
    const successful = results.filter(r => r.result.some(res => res.success)).length
    const failed = results.length - successful

    console.log({
      event: 'manual_notification_sent',
      admin_id: authUser.id,
      admin_name: userData.name,
      recipient_count: userIds.length,
      successful,
      failed,
      channels: channels.join(', '),
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      sent: successful,
      failed,
      total: results.length,
      results
    })
  } catch (error) {
    console.error("Error in send manual notification API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
