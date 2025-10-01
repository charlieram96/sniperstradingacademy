import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

// Get the correct base URL for callbacks
const getBaseUrl = () => {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL
  if (process.env.AUTH_URL) return process.env.AUTH_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

export const authConfig: NextAuthConfig = {
  providers: [
    // Only add Google if credentials are available
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
        authorization: {
          params: {
            prompt: "consent",
            access_type: "offline",
            response_type: "code",
            redirect_uri: `${getBaseUrl()}/api/auth/callback/google`
          }
        }
      })
    ] : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const validatedFields = loginSchema.safeParse(credentials)

        if (!validatedFields.success) {
          return null
        }

        const { email, password } = validatedFields.data

        // Test account check
        if (email === "test@example.com" && password === "testpass123") {
          return {
            id: "test-user-id-123",
            email: "test@example.com",
            name: "Demo Trader",
          }
        }

        try {
          const supabase = await createClient()

          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          })

          if (error || !data.user) {
            return null
          }

          return {
            id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata?.name || null,
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
    signOut: "/",
  },
  callbacks: {
    async signIn({ user, account }) {
      // Only handle Google OAuth
      if (account?.provider === "google") {
        const supabase = await createClient()

        // Check if user exists in our database
        const { data: existingUser } = await supabase
          .from("users")
          .select("id, referred_by")
          .eq("email", user.email)
          .single()

        // If user doesn't exist, create them (they'll need to complete signup with referral)
        if (!existingUser) {
          const { error } = await supabase
            .from("users")
            .insert({
              email: user.email,
              name: user.name,
              // Don't set referred_by yet - they need to complete signup
            })

          if (error) {
            console.error("Error creating user:", error)
          }
        }
      }
      return true
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
      }
      return token
    },
    async redirect({ url, baseUrl }) {
      // Always use the production URL if available
      const productionUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || baseUrl

      // If explicitly going to /complete-signup, allow it
      if (url.includes('/complete-signup')) {
        if (url.startsWith("/")) {
          return `${productionUrl}${url}`
        }
        return url
      }

      // If the URL is relative, make it absolute with the correct base
      if (url.startsWith("/")) {
        return `${productionUrl}${url}`
      }

      // If the URL is for localhost but we're in production, replace it
      if (url.includes("localhost") && productionUrl.includes("sniperstradingacademy")) {
        return url.replace(/http:\/\/localhost:\d+/, productionUrl)
      }

      // Allow callback URLs on the same origin
      if (new URL(url).origin === productionUrl) {
        return url
      }

      return productionUrl
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
}