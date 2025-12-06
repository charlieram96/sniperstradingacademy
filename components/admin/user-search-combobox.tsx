"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

export interface PayoutUser {
  id: string
  name: string | null
  email: string
  payout_wallet_address: string | null
}

interface UserSearchComboboxProps {
  value?: string
  onValueChange: (userId: string) => void
  users: PayoutUser[]
  disabled?: boolean
}

export function UserSearchCombobox({
  value,
  onValueChange,
  users,
  disabled = false
}: UserSearchComboboxProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const selectedUser = users.find((user) => user.id === value)

  // Filter users based on search query
  const filteredUsers = users.filter((user) => {
    const searchLower = searchQuery.toLowerCase()
    const name = user.name?.toLowerCase() || ""
    const email = user.email.toLowerCase()
    return name.includes(searchLower) || email.includes(searchLower)
  })

  // Only show users with payout wallet addresses configured
  const eligibleUsers = filteredUsers.filter(
    (user) => user.payout_wallet_address !== null
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedUser ? (
            <div className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {selectedUser.name || selectedUser.email}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">Select user...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="p-2">
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
          />
        </div>
        <ScrollArea className="h-[300px]">
          <div className="p-2 space-y-1">
            {eligibleUsers.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {searchQuery
                  ? "No users found."
                  : "No users with payout wallets configured."}
              </div>
            ) : (
              eligibleUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    onValueChange(user.id)
                    setOpen(false)
                    setSearchQuery("")
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-2 rounded-sm hover:bg-accent",
                    value === user.id && "bg-accent"
                  )}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value === user.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {user.name || "No name"}
                      </p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        Wallet Set
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
