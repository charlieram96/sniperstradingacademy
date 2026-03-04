"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Search, LogOut, Bell, ChevronRight, User, Settings, Mail } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { createClient } from "@/lib/supabase/client"

interface DashboardHeaderProps {
  user: {
    email?: string
    user_metadata?: {
      name?: string
    }
  }
}

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  academy: "Academy",
  team: "My Team",
  finance: "Finance",
  payments: "Payments",
  referrals: "Referrals",
  settings: "Settings",
  notifications: "Notifications",
  admin: "Admin",
  classes: "Admin Panel",
  network: "Network View",
  "network-visualizer": "Network Visualizer",
  financials: "Financials",
  payouts: "Payouts",
  "direct-bonuses": "Direct Bonuses",
  "transaction-logs": "Transaction Logs",
  "academy-manager": "Academy Manager",
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  // Build breadcrumbs
  const segments = pathname.split("/").filter(Boolean)
  const breadcrumbs = segments.map((seg, idx) => ({
    label: ROUTE_LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
    href: "/" + segments.slice(0, idx + 1).join("/"),
    isLast: idx === segments.length - 1,
  }))

  return (
    <header
      className="h-14 fixed right-0 left-0 z-50 flex items-center justify-between px-6 lg:pl-[80px] bg-background/80 backdrop-blur-xl border-b border-white/[0.06]"
      style={{
        top: 'var(--banner-height, 0px)',
      }}
    >
      {/* Left side - Logo + Breadcrumbs */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Image
            src="/gold-logo.svg"
            alt="Logo"
            width={24}
            height={24}
            className="w-6 h-6"
          />
        </Link>

        {/* Breadcrumbs - desktop */}
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {breadcrumbs.map((crumb, idx) => (
            <div key={crumb.href} className="flex items-center gap-1">
              {idx > 0 && <ChevronRight className="h-3 w-3 text-foreground-quaternary" />}
              {crumb.isLast ? (
                <span className="text-foreground font-medium">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="text-foreground-tertiary hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Search trigger */}
        {isSearchOpen ? (
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Search..."
              className="w-64 h-8 text-sm"
              autoFocus
              onBlur={() => setIsSearchOpen(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setIsSearchOpen(true)}
            className="hidden md:flex items-center gap-2 h-8 px-3 rounded-[6px] border border-border bg-surface-1 text-foreground-tertiary text-sm hover:border-border-strong transition-colors duration-150"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search...</span>
            <kbd className="ml-4 text-[10px] font-mono text-foreground-quaternary bg-surface-0 px-1.5 py-0.5 rounded-[3px] border border-border-subtle">⌘K</kbd>
          </button>
        )}

        {/* Mobile search */}
        <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setIsSearchOpen(!isSearchOpen)}>
          <Search className="h-4 w-4" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
        </Button>

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 gap-2 px-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-gradient-to-br from-gold-400 to-gold-500 text-primary-foreground text-xs font-medium">
                  {user.email?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm font-medium max-w-[100px] truncate">
                {user.user_metadata?.name || user.email?.split("@")[0]}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user.user_metadata?.name || "User"}
                </p>
                <p className="text-[11px] leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <User className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="mailto:support@sniperstradingacademy.com">
                <Mail className="h-4 w-4 mr-2" />
                Contact Support
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-400">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
