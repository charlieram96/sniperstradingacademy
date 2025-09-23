import { signOut } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST() {
  await signOut({ redirect: false })
  return NextResponse.redirect(new URL("/", process.env.NEXTAUTH_URL || process.env.AUTH_URL || "http://localhost:3000"))
}

export async function GET() {
  await signOut({ redirect: false })
  return NextResponse.redirect(new URL("/", process.env.NEXTAUTH_URL || process.env.AUTH_URL || "http://localhost:3000"))
}