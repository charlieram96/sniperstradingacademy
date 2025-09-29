"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"

export function AddTestMembersButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  
  const handleAddTestMembers = async () => {
    if (!confirm('This will add test members to your account. Continue?')) {
      return
    }
    
    setLoading(true)
    
    try {
      const response = await fetch('/api/test/add-members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json()
      
      if (response.ok) {
        alert(`Successfully added ${data.summary.total} test members!
        
Level 1: ${data.summary.level1} members
Level 2: ${data.summary.level2} members  
Level 3: ${data.summary.level3} members
Level 4: ${data.summary.level4} members`)
        
        // Refresh the page to show new members
        router.refresh()
        window.location.reload()
      } else {
        alert('Error adding test members: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to add test members')
    } finally {
      setLoading(false)
    }
  }
  
  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null
  }
  
  return (
    <Button
      onClick={handleAddTestMembers}
      disabled={loading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Adding test members...
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          Add Test Members (Dev Only)
        </>
      )}
    </Button>
  )
}