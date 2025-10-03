import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
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
      const { data: userData } = await supabase
        .from("users")
        .select("referred_by, network_position_id")
        .eq("id", session.user.id)
        .single()

      // If user doesn't have a referral or network position, redirect to complete-signup
      // This means they're signing up via OAuth for the first time
      if (userData && !userData.referred_by && !userData.network_position_id) {
        console.log("New OAuth user detected, redirecting to complete-signup")
        return NextResponse.redirect(`${requestUrl.origin}/complete-signup`)
      }
    }
  }

  // Redirect to the next URL or dashboard
  return NextResponse.redirect(`${requestUrl.origin}${next}`)
}
