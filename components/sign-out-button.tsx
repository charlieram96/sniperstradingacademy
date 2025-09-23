"use client"

import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { signOut } from "next-auth/react"

export function SignOutButton() {
  const handleSignOut = async () => {
    // Get the current origin to ensure proper redirect
    const currentOrigin = window.location.origin
    await signOut({ 
      callbackUrl: currentOrigin + "/",
      redirect: true 
    })
  }

  return (
    <Button 
      onClick={handleSignOut}
      variant="ghost" 
      className="w-full justify-start text-gray-400 hover:text-white hover:bg-gray-800"
    >
      <LogOut className="h-4 w-4 mr-2" />
      Sign out
    </Button>
  )
}