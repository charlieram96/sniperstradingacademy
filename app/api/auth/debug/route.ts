import { NextResponse } from "next/server"

export async function GET() {
  // Only show this in development or with a secret query param
  const isDev = process.env.NODE_ENV === "development"
  
  // Check which environment variables are set (without exposing values)
  const envCheck = {
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    AUTH_URL: !!process.env.AUTH_URL,
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    AUTH_GOOGLE_ID: !!process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: !!process.env.AUTH_GOOGLE_SECRET,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NODE_ENV: process.env.NODE_ENV,
    // Show actual URLs (these are not sensitive)
    AUTH_URL_VALUE: process.env.AUTH_URL || "NOT SET",
    NEXTAUTH_URL_VALUE: process.env.NEXTAUTH_URL || "NOT SET",
  }

  if (!isDev) {
    // In production, only show critical info
    return NextResponse.json({
      message: "Auth configuration check",
      critical: {
        AUTH_SECRET_SET: envCheck.AUTH_SECRET,
        AUTH_URL: envCheck.AUTH_URL_VALUE,
        NEXTAUTH_URL: envCheck.NEXTAUTH_URL_VALUE,
      }
    })
  }

  return NextResponse.json(envCheck)
}