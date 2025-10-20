import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const mode = requestUrl.searchParams.get("mode") // 'login' or null (signup)
  const next = requestUrl.searchParams.get("next") || "/dashboard"

  if (code) {
    const supabase = await createClient()
    const { data: session, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error("Error exchanging code for session:", error)
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed`)
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

      // User data exists - check if they have referral and network position
      const isNewUser = !userData.referred_by && !userData.network_position_id

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
        console.log("New OAuth user detected, redirecting to complete-signup")
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
