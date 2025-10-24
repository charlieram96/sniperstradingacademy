import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => req.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isLoggedIn = !!user

  // Check MFA status
  let needsMFA = false
  if (isLoggedIn) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    // User needs MFA if they're at aal1 but should be at aal2
    needsMFA = aalData?.currentLevel === 'aal1' && aalData?.nextLevel === 'aal2'
  }

  const isAuthPage = req.nextUrl.pathname.startsWith("/login") ||
                     req.nextUrl.pathname.startsWith("/register")
  const isMFAPage = req.nextUrl.pathname.startsWith("/mfa-verify")
  const isDashboard = req.nextUrl.pathname.startsWith("/dashboard") ||
                      req.nextUrl.pathname.startsWith("/academy") ||
                      req.nextUrl.pathname.startsWith("/team") ||
                      req.nextUrl.pathname.startsWith("/finance") ||
                      req.nextUrl.pathname.startsWith("/group") ||
                      req.nextUrl.pathname.startsWith("/payments") ||
                      req.nextUrl.pathname.startsWith("/referrals") ||
                      req.nextUrl.pathname.startsWith("/settings")

  // Redirect to login if not authenticated
  if (isDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // If user needs MFA but hasn't completed it, redirect to MFA verify page
  if (isLoggedIn && needsMFA && !isMFAPage) {
    return NextResponse.redirect(new URL("/mfa-verify", req.url))
  }

  // Redirect authenticated users away from auth pages (but not from MFA page)
  if (isAuthPage && isLoggedIn) {
    // Only redirect if they don't need MFA, or if they've already completed it
    if (!needsMFA) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    // If they need MFA, redirect to MFA verify instead
    return NextResponse.redirect(new URL("/mfa-verify", req.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
}