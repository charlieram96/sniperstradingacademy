"use client"

import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { signOut } from "next-auth/react"
import { useState } from "react"

export function SignOutButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    try {
      setIsLoading(true)
      // Use window.location for a hard redirect as a fallback
      await signOut({ 
        redirect: false 
      })
      window.location.href = "/"
    } catch (error) {
      console.error("Sign out error:", error)
      // Fallback: clear session and redirect
      window.location.href = "/"
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button 
      onClick={handleSignOut}
      disabled={isLoading}
      variant="ghost" 
      className="w-full justify-start text-gray-400 hover:text-white hover:bg-gray-800"
    >
      <LogOut className="h-4 w-4 mr-2" />
      {isLoading ? "Signing out..." : "Sign out"}
    </Button>
  )
}