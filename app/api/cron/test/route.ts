import { NextRequest, NextResponse } from "next/server"

// Test endpoint to verify cron configuration
export async function GET(req: NextRequest) {
  // Log all headers for debugging
  const headers: { [key: string]: string } = {}
  req.headers.forEach((value, key) => {
    headers[key] = value
  })

  console.log("[CRON TEST] Request received at:", new Date().toISOString())
  console.log("[CRON TEST] Headers:", JSON.stringify(headers, null, 2))
  
  // Check for authorization header
  const authHeader = req.headers.get("authorization")
  const hasValidAuth = authHeader === `Bearer ${process.env.CRON_SECRET}`
  
  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    message: "Cron test endpoint working",
    authStatus: hasValidAuth ? "Valid" : "Invalid or missing",
    environment: process.env.NODE_ENV,
    // Only show in development
    ...(process.env.NODE_ENV !== "production" && {
      receivedAuth: authHeader ? "Bearer token received" : "No auth header",
      headers: headers
    })
  })
}