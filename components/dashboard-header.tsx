"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, LogOut, Bell, User, Settings, Mail } from "lucide-react"
import { LiveClassIndicator } from "@/components/academy/live-class-indicator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
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
import { LanguageToggle } from "@/components/language-toggle"
import { useTranslation } from "@/components/language-provider"

interface DashboardHeaderProps {
  user: {
    email?: string
    user_metadata?: {
      name?: string
    }
  }
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMac, setIsMac] = useState(true)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { t } = useTranslation()

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent))
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <header
      className="h-14 fixed right-0 left-0 lg:left-[72px] z-40 flex items-center justify-between px-6 bg-background/80 backdrop-blur-xl border-b border-white/[0.06]"
      style={{
        top: 'var(--banner-height, 0px)',
      }}
    >
      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Search trigger */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="hidden md:flex items-center gap-2 h-8 px-3 rounded-[6px] border border-border bg-surface-1 text-foreground-tertiary text-sm hover:border-border-strong transition-colors duration-150"
        >
          <Search className="h-3.5 w-3.5" />
          <span>{t("common.search")}</span>
          <kbd className="ml-4 text-[10px] font-mono text-foreground-quaternary bg-surface-0 px-1.5 py-0.5 rounded-[3px] border border-border-subtle">{isMac ? "⌘K" : "Ctrl K"}</kbd>
        </button>

        {/* Mobile search */}
        <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setIsSearchOpen(true)}>
          <Search className="h-4 w-4" />
        </Button>

        {/* Search command palette */}
        <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogContent
            className="max-w-lg top-[20%] translate-y-0 p-0 gap-0"
            showCloseButton={false}
          >
            <VisuallyHidden><DialogTitle>{t("common.search")}</DialogTitle></VisuallyHidden>
            <div className="flex items-center gap-3 px-4 py-3">
              <Search className="h-4 w-4 text-foreground-tertiary shrink-0" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder={t("common.search")}
                className="border-0 bg-transparent h-auto p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-3 px-4 py-2 border-t border-border-subtle">
              <span className="text-[11px] text-foreground-quaternary">
                <kbd className="font-mono text-[10px] bg-surface-0 px-1.5 py-0.5 rounded-[3px] border border-border-subtle">Esc</kbd>
                <span className="ml-1.5">{t("common.toClose")}</span>
              </span>
            </div>
          </DialogContent>
        </Dialog>

        {/* Academy live class indicator */}
        <LiveClassIndicator />

        {/* Language toggle */}
        <LanguageToggle />

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
                  {user.user_metadata?.name || t("common.user")}
                </p>
                <p className="text-[11px] leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <User className="h-4 w-4 mr-2" />
              {t("header.profile")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="h-4 w-4 mr-2" />
              {t("header.settings")}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="mailto:support@sniperstradingacademy.com">
                <Mail className="h-4 w-4 mr-2" />
                {t("header.contactSupport")}
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-400">
              <LogOut className="h-4 w-4 mr-2" />
              {t("header.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
