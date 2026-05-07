import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/notifications/twilio/email-service"

export const runtime = "nodejs"

type ResetMethod = "send_link" | "temporary_password"

/**
 * POST /api/admin/users/reset-password
 * Superadmin+ only. Two methods:
 *   - "send_link": email a Supabase recovery link (delivered via SendGrid).
 *   - "temporary_password": generate a temp password, force user to change on next login.
 * Rejects users without an email/password identity.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: adminData } = await supabase
      .from("users")
      .select("role, name")
      .eq("id", user.id)
      .single()

    if (adminData?.role !== "superadmin+") {
      return NextResponse.json({ error: "Forbidden - superadmin+ required" }, { status: 403 })
    }

    const body = await request.json().catch(() => null) as
      | { user_id?: string; method?: ResetMethod }
      | null

    if (!body?.user_id || !body?.method) {
      return NextResponse.json(
        { error: "user_id and method are required" },
        { status: 400 }
      )
    }

    if (body.method !== "send_link" && body.method !== "temporary_password") {
      return NextResponse.json(
        { error: "method must be 'send_link' or 'temporary_password'" },
        { status: 400 }
      )
    }

    const adminClient = createServiceRoleClient()
    const { data: { user: targetUser }, error: targetError } =
      await adminClient.auth.admin.getUserById(body.user_id)

    if (targetError || !targetUser?.email) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const hasPasswordIdentity = (targetUser.identities ?? []).some(
      (identity) => identity.provider === "email"
    )

    if (!hasPasswordIdentity) {
      return NextResponse.json(
        { error: "User signed in with OAuth; no password to reset." },
        { status: 400 }
      )
    }

    const triggeredBy = adminData?.name || user.email || "Administrator"

    if (body.method === "send_link") {
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: targetUser.email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
        },
      })

      if (linkError || !linkData?.properties?.action_link) {
        console.error("[ResetPassword] generateLink error:", linkError)
        return NextResponse.json({ error: "Failed to generate reset link" }, { status: 500 })
      }

      const emailResult = await sendEmail({
        to: targetUser.email,
        subject: "Reset your password",
        html: buildSendLinkEmailHtml({
          actionLink: linkData.properties.action_link,
          triggeredBy,
        }),
      })

      if (!emailResult.success) {
        console.error("[ResetPassword] SendGrid error (send_link):", emailResult.error)
        return NextResponse.json(
          { error: "Failed to send reset email" },
          { status: 500 }
        )
      }

      await supabase.from("crypto_audit_log").insert({
        event_type: "admin_action",
        admin_id: user.id,
        entity_type: "user",
        entity_id: body.user_id,
        details: {
          action: "password_reset_link_sent",
          target_email: targetUser.email,
          triggered_by: triggeredBy,
        },
      })

      return NextResponse.json({
        success: true,
        method: "send_link",
        message: `Password reset email sent to ${targetUser.email}`,
      })
    }

    // method === "temporary_password"
    const tempPassword = generateTempPassword()

    const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(
      body.user_id,
      { password: tempPassword }
    )

    if (updateAuthError) {
      console.error("[ResetPassword] updateUserById error:", updateAuthError)
      return NextResponse.json(
        { error: "Failed to set temporary password" },
        { status: 500 }
      )
    }

    const { error: flagError } = await adminClient
      .from("users")
      .update({ force_password_change: true })
      .eq("id", body.user_id)

    if (flagError) {
      console.error("[ResetPassword] force_password_change update error:", flagError)
      return NextResponse.json(
        { error: "Password set but failed to flag for forced change" },
        { status: 500 }
      )
    }

    const emailResult = await sendEmail({
      to: targetUser.email,
      subject: "Your password has been reset by an administrator",
      html: buildTempPasswordEmailHtml({ triggeredBy, tempPassword }),
    })

    if (!emailResult.success) {
      // Non-fatal: password is set, flag is set; we just couldn't email the notice.
      console.error("[ResetPassword] SendGrid error (temporary_password):", emailResult.error)
    }

    await supabase.from("crypto_audit_log").insert({
      event_type: "admin_action",
      admin_id: user.id,
      entity_type: "user",
      entity_id: body.user_id,
      details: {
        action: "password_reset_temp_password_set",
        target_email: targetUser.email,
        triggered_by: triggeredBy,
        notification_email_sent: emailResult.success,
      },
    })

    return NextResponse.json({
      success: true,
      method: "temporary_password",
      tempPassword,
      message: `Temporary password set for ${targetUser.email}`,
      notification_email_sent: emailResult.success,
    })
  } catch (error) {
    console.error("[ResetPassword] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function generateTempPassword(): string {
  // 16 chars, base64url, with ambiguous chars (0, O, l, I) stripped to avoid copy mistakes.
  const raw = crypto.randomBytes(24).toString("base64url")
  const cleaned = raw.replace(/[0OlI]/g, "")
  return cleaned.slice(0, 16)
}

function buildSendLinkEmailHtml({
  actionLink,
  triggeredBy,
}: {
  actionLink: string
  triggeredBy: string
}): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111827;">
      <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 16px;">Reset your password</h1>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
        ${escapeHtml(triggeredBy)} initiated a password reset for your Snipers Trading Academy account.
      </p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        Click the button below to choose a new password. This link will expire shortly for your security.
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${actionLink}" style="display: inline-block; background: #D4A853; color: #0F1629; font-weight: 600; padding: 12px 20px; border-radius: 8px; text-decoration: none;">
          Reset password
        </a>
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #6b7280; margin: 0 0 8px;">
        If the button doesn't work, copy and paste this URL into your browser:
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #6b7280; word-break: break-all; margin: 0 0 24px;">
        ${actionLink}
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #6b7280; margin: 0;">
        If you weren't expecting this email, please contact support.
      </p>
    </div>
  `
}

function buildTempPasswordEmailHtml({
  triggeredBy,
  tempPassword,
}: {
  triggeredBy: string
  tempPassword: string
}): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111827;">
      <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 16px;">Your password has been reset</h1>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
        ${escapeHtml(triggeredBy)} reset your Snipers Trading Academy password and assigned a temporary one.
      </p>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 8px; color: #374151;">Your temporary password:</p>
      <div style="background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px 16px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 16px; font-weight: 600; letter-spacing: 0.5px; word-break: break-all; margin: 0 0 20px;">
        ${escapeHtml(tempPassword)}
      </div>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
        Use this password to log in. You will be required to choose a new password before you can continue.
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #b45309; background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; padding: 10px 12px; margin: 0 0 24px;">
        <strong>Security tip:</strong> for your protection, log in and change this password as soon as possible. Do not share it with anyone, and delete this email after you've reset your password.
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #6b7280; margin: 0;">
        If you weren't expecting this, please contact support immediately.
      </p>
    </div>
  `
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
