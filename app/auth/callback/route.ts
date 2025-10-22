import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const mode = requestUrl.searchParams.get("mode") // 'login' or null (signup)
  const next = requestUrl.searchParams.get("next") || "/dashboard"
  const type = requestUrl.searchParams.get("type") // 'recovery' for password reset

  if (code) {
    const supabase = await createClient()
    const { data: session, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error("Error exchanging code for session:", error)

      // If this is a password reset and exchange failed, still redirect to reset page
      if (type === "recovery") {
        return NextResponse.redirect(`${requestUrl.origin}/reset-password`)
      }

      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed`)
    }

    // Handle password reset flow
    if (type === "recovery" || next === "/reset-password") {
      console.log("Password reset requested, redirecting to reset-password page")
      return NextResponse.redirect(`${requestUrl.origin}/reset-password`)
    }

    // Check if this is a new user without a referral or network position
    if (session?.user) {
      // Log email verification for debugging
      if (session.user.email_confirmed_at) {
        console.log(`✅ Email verified for user: ${session.user.email}`)
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("referred_by, network_position_id")
        .eq("id", session.user.id)
        .single()

      // If userData query failed or user not found in database yet
      if (userError || !userData) {
        console.error("Error fetching user data:", userError)

        // If this was a login attempt, block it - new users must sign up first
        if (mode === "login") {
          console.log("Blocking new user from login flow - must sign up first")
          // Sign out the newly created user
          await supabase.auth.signOut()
          return NextResponse.redirect(
            `${requestUrl.origin}/register?error=account_not_found&message=No account found. Please sign up first.`
          )
        }

        // If signup flow but userData not ready, redirect to complete-signup
        console.log("New OAuth user detected (no user data yet), redirecting to complete-signup")
        return NextResponse.redirect(`${requestUrl.origin}/complete-signup`)
      }

      // Root user ID - used as default by database trigger when no referrer specified
      const ROOT_USER_ID = 'b10f0367-0471-4eab-9d15-db68b1ac4556'

      // Check if this is a new/incomplete user
      // Consider user incomplete if:
      // 1. No referred_by at all
      // 2. referred_by equals root (likely defaulted by trigger for OAuth signup)
      // 3. No network position assigned yet
      const isRootDefaulted = userData.referred_by === ROOT_USER_ID
      const isNewUser = !userData.referred_by || isRootDefaulted || !userData.network_position_id

      if (isNewUser) {
        // If this was a login attempt with a new/incomplete user, block it
        if (mode === "login") {
          console.log("Blocking incomplete user from login flow")
          await supabase.auth.signOut()
          return NextResponse.redirect(
            `${requestUrl.origin}/register?error=incomplete_signup&message=Please complete your signup with a referral code.`
          )
        }

        // If signup flow, redirect to complete-signup to get referral
        if (isRootDefaulted) {
          console.log("OAuth user with root referrer detected (trigger default), redirecting to complete-signup")
        } else {
          console.log("New OAuth user detected, redirecting to complete-signup")
        }
        return NextResponse.redirect(`${requestUrl.origin}/complete-signup`)
      }

      // For email verification (user already has referral/position), go to dashboard
      if (session.user.email_confirmed_at && userData.referred_by) {
        console.log(`✅ Email verification complete. Redirecting to dashboard: ${session.user.email}`)
        return NextResponse.redirect(`${requestUrl.origin}/dashboard`)
      }
    }
  }

  // Redirect to the next URL or dashboard
  return NextResponse.redirect(`${requestUrl.origin}${next}`)
}
