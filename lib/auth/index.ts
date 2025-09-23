import NextAuth from "next-auth"
import { authConfig } from "./config"

// Validate required environment variables
if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
  console.error("Warning: AUTH_SECRET or NEXTAUTH_SECRET is not set")
}

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig)