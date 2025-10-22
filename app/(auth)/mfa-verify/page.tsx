"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { MFAChallenge } from "@/components/mfa/mfa-challenge"

export default function MFAVerifyPage() {
  const router = useRouter()

  useEffect(() => {
    // Check if user actually needs MFA verification
    const checkMFAStatus = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

      if (error || !data) {
        // Redirect to login if there's an error
        router.push("/login")
        return
      }

      // If already verified (aal2) or no MFA needed, redirect to dashboard
      if (data.currentLevel === "aal2" || data.nextLevel === "aal1") {
        router.push("/dashboard")
      }
    }

    checkMFAStatus()
  }, [router])

  return <MFAChallenge />
}
