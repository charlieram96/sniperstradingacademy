"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { NavigationLink } from "@/components/navigation-link"
import { sidebarAnimation, sidebarMobile, sidebarOverlay } from "@/lib/motion"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Share2,
  GraduationCap,
  DollarSign,
  Shield,
  Network,
  TrendingUp,
  Wallet,
  Settings,
  GitBranch,
  Activity,
  BookOpen,
  Bell,
  Gift,
  LogOut,
  Menu,
  X,
  MoreVertical,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface SidebarProps {
  user: {
    email?: string
    user_metadata?: {
      name?: string
    }
  }
  isActive: boolean
  isAdminOrSuper: boolean
  isSuperAdmin: boolean
  isSuperAdminPlus: boolean
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, requiresActive: true },
  { href: "/academy", label: "Academy", icon: GraduationCap, requiresActive: true },
  { href: "/team", label: "My Team", icon: Users, requiresActive: true },
  { href: "/finance", label: "Finance", icon: DollarSign, requiresActive: true },
  { href: "/payments", label: "Payments", icon: CreditCard, requiresActive: false },
  { href: "/referrals", label: "Referrals", icon: Share2, requiresActive: true },
]

const secondaryItems = [
  { href: "/notifications", label: "Notifications", icon: Bell, requiresActive: true },
  { href: "/settings", label: "Settings", icon: Settings, requiresActive: false },
]

export function Sidebar({ user, isActive, isAdminOrSuper, isSuperAdmin, isSuperAdminPlus }: SidebarProps) {
  const [hovered, setHovered] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()
  const leaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isExpanded = hovered

  const handleMouseEnter = useCallback(() => {
    if (leaveTimeout.current) {
      clearTimeout(leaveTimeout.current)
      leaveTimeout.current = null
    }
    setHovered(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    leaveTimeout.current = setTimeout(() => {
      setHovered(false)
    }, 150)
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (leaveTimeout.current) clearTimeout(leaveTimeout.current)
    }
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [])

  const sidebarContent = (
    <nav className="flex-1 py-4 overflow-y-auto">
      <div className="px-2 pb-[5px]">
        <p className={`text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 px-3 whitespace-nowrap h-4 mb-px transition-opacity duration-150 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>Navigation</p>
        {navItems.map((item) => (
          <NavigationLink
            key={item.href}
            href={item.href}
            isLocked={item.requiresActive && !isActive}
            className="flex items-center gap-[10px] pl-4 pr-3 py-[10px] mx-1 rounded-[6px] text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-150 group cursor-pointer relative whitespace-nowrap"
          >
            <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary flex-shrink-0" />
            <span className={`text-sm font-medium whitespace-nowrap transition-opacity duration-150 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>{item.label}</span>
          </NavigationLink>
        ))}
      </div>

      <div className={`mx-3 border-t border-border-subtle my-3`} />

      <div className="px-2 pb-[5px]">
        <p className={`text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 px-3 whitespace-nowrap h-4 mb-px transition-opacity duration-150 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>General</p>
        {secondaryItems.map((item) => (
          <NavigationLink
            key={item.href}
            href={item.href}
            isLocked={item.requiresActive && !isActive}
            className="flex items-center gap-[10px] pl-4 pr-3 py-[10px] mx-1 rounded-[6px] text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-150 group cursor-pointer whitespace-nowrap"
          >
            <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary flex-shrink-0" />
            <span className={`text-sm font-medium whitespace-nowrap transition-opacity duration-150 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>{item.label}</span>
          </NavigationLink>
        ))}
      </div>

      {/* Admin Section */}
      {isAdminOrSuper && (
        <>
          <div className={`mx-3 border-t border-border-subtle my-3`} />
          <div className="px-2 pb-[5px]">
            <p className={`text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 px-3 whitespace-nowrap h-4 mb-px transition-opacity duration-150 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>Admin</p>

            <Accordion type="multiple" className="mx-1">
              <AccordionItem value="notifiers" className="border-b-0">
                <AccordionTrigger className={`flex items-center gap-[10px] pl-4 pr-3 py-[10px] rounded-[6px] text-sidebar-foreground hover:text-gold-400 transition-all duration-150 hover:no-underline whitespace-nowrap ${!isExpanded ? '[&>svg]:hidden pointer-events-none' : ''}`}>
                  <div className="flex items-center gap-[10px] flex-1">
                    <Bell className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className={`text-sm font-medium whitespace-nowrap transition-opacity duration-150 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Notifiers</span>
                  </div>
                </AccordionTrigger>
                {isExpanded && (
                  <AccordionContent className="pb-0">
                    <NavigationLink
                      href="/admin/classes"
                      className="flex items-center gap-[10px] pl-8 pr-3 py-[10px] rounded-[6px] text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-150 group cursor-pointer whitespace-nowrap"
                    >
                      <Shield className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
                      <span className="text-sm font-medium">Admin Panel</span>
                    </NavigationLink>
                    {isSuperAdmin && (
                      <NavigationLink
                        href="/admin/notifications"
                        className="flex items-center gap-[10px] pl-8 pr-3 py-[10px] rounded-[6px] text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-150 group cursor-pointer whitespace-nowrap"
                      >
                        <Bell className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
                        <span className="text-sm font-medium">Notifications Manager</span>
                      </NavigationLink>
                    )}
                  </AccordionContent>
                )}
              </AccordionItem>

              <AccordionItem value="network" className="border-b-0">
                <AccordionTrigger className={`flex items-center gap-[10px] pl-4 pr-3 py-[10px] rounded-[6px] text-sidebar-foreground hover:text-gold-400 transition-all duration-150 hover:no-underline whitespace-nowrap ${!isExpanded ? '[&>svg]:hidden pointer-events-none' : ''}`}>
                  <div className="flex items-center gap-[10px] flex-1">
                    <Network className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className={`text-sm font-medium whitespace-nowrap transition-opacity duration-150 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Network</span>
                  </div>
                </AccordionTrigger>
                {isExpanded && (
                  <AccordionContent className="pb-0">
                    <NavigationLink
                      href="/admin/network"
                      className="flex items-center gap-[10px] pl-8 pr-3 py-[10px] rounded-[6px] text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-150 group cursor-pointer whitespace-nowrap"
                    >
                      <Network className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
                      <span className="text-sm font-medium">Network View</span>
                    </NavigationLink>
                    {isSuperAdmin && (
                      <NavigationLink
                        href="/admin/network-visualizer"
                        className="flex items-center gap-[10px] pl-8 pr-3 py-[10px] rounded-[6px] text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-150 group cursor-pointer whitespace-nowrap"
                      >
                        <GitBranch className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
                        <span className="text-sm font-medium">Network Visualizer</span>
                      </NavigationLink>
                    )}
                  </AccordionContent>
                )}
              </AccordionItem>

              {isSuperAdminPlus && (
                <AccordionItem value="payments" className="border-b-0">
                  <AccordionTrigger className={`flex items-center gap-[10px] pl-4 pr-3 py-[10px] rounded-[6px] text-sidebar-foreground hover:text-gold-400 transition-all duration-150 hover:no-underline whitespace-nowrap ${!isExpanded ? '[&>svg]:hidden pointer-events-none' : ''}`}>
                    <div className="flex items-center gap-[10px] flex-1">
                      <Wallet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className={`text-sm font-medium whitespace-nowrap transition-opacity duration-150 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Payments</span>
                    </div>
                  </AccordionTrigger>
                  {isExpanded && (
                    <AccordionContent className="pb-0">
                      <NavigationLink
                        href="/admin/financials"
                        className="flex items-center gap-[10px] pl-8 pr-3 py-[10px] rounded-[6px] text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-150 group cursor-pointer whitespace-nowrap"
                      >
                        <TrendingUp className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
                        <span className="text-sm font-medium">Financials</span>
                      </NavigationLink>
                      <NavigationLink
                        href="/admin/payouts"
                        className="flex items-center gap-[10px] pl-8 pr-3 py-[10px] rounded-[6px] text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-150 group cursor-pointer whitespace-nowrap"
                      >
                        <Wallet className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
                        <span className="text-sm font-medium">Payouts</span>
                      </NavigationLink>
                      <NavigationLink
                        href="/admin/direct-bonuses"
                        className="flex items-center gap-[10px] pl-8 pr-3 py-[10px] rounded-[6px] text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-150 group cursor-pointer whitespace-nowrap"
                      >
                        <Gift className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
                        <span className="text-sm font-medium">Direct Bonuses</span>
                      </NavigationLink>
                    </AccordionContent>
                  )}
                </AccordionItem>
              )}
            </Accordion>

            {isSuperAdmin && (
              <>
                <NavigationLink
                  href="/admin/transaction-logs"
                  className="flex items-center gap-[10px] pl-4 pr-3 py-[10px] mx-1 rounded-[6px] text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-150 group cursor-pointer whitespace-nowrap"
                >
                  <Activity className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary flex-shrink-0" />
                  <span className={`text-sm font-medium whitespace-nowrap transition-opacity duration-150 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Transaction Logs</span>
                </NavigationLink>
                <NavigationLink
                  href="/admin/academy-manager"
                  className="flex items-center gap-[10px] pl-4 pr-3 py-[10px] mx-1 rounded-[6px] text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-150 group cursor-pointer whitespace-nowrap"
                >
                  <BookOpen className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary flex-shrink-0" />
                  <span className={`text-sm font-medium whitespace-nowrap transition-opacity duration-150 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Academy Manager</span>
                </NavigationLink>
              </>
            )}
          </div>
        </>
      )}
    </nav>
  )

  const userSection = (
    <div className="p-3 border-t border-border-subtle">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 w-full rounded-[6px] px-2 py-2 hover:bg-white/[0.04] transition-colors duration-150 whitespace-nowrap">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center text-primary-foreground text-sm font-medium shadow-[var(--shadow-gold-sm)] flex-shrink-0">
              {user.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className={`flex-1 min-w-0 text-left whitespace-nowrap transition-opacity duration-150 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user.user_metadata?.name || "User"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
            <MoreVertical className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-opacity duration-150 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{user.user_metadata?.name || "User"}</p>
            <p className="text-[11px] text-muted-foreground">{user.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-red-400">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-[55] p-2 rounded-[6px] bg-surface-2 border border-border shadow-[var(--shadow-sm)] lg:hidden"
        style={{ top: 'calc(var(--banner-height, 0px) + 10px)' }}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              variants={sidebarOverlay}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-[59] bg-black/60 lg:hidden"
            />
            <motion.aside
              variants={sidebarMobile}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed top-0 left-0 bottom-0 z-[60] w-[260px] flex flex-col bg-[#080C1A] border-r border-border-subtle lg:hidden"
              style={{ paddingTop: 'calc(var(--banner-height, 0px) + var(--inactive-banner-height, 0px) + var(--wallet-banner-height, 0px))' }}
            >
              <div className="flex items-center justify-between px-3 h-14 flex-shrink-0">
                <Link href="/dashboard" className="flex items-center justify-center hover:opacity-80 transition-opacity">
                  <Image src="/gold-logo.svg" alt="Logo" width={28} height={28} />
                </Link>
                <button onClick={() => setMobileOpen(false)} className="p-1 rounded-[4px] hover:bg-white/[0.06]">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {sidebarContent}
              {userSection}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        variants={sidebarAnimation}
        animate={!isExpanded ? "collapsed" : "expanded"}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="hidden lg:flex flex-col fixed left-0 bottom-0 z-50 bg-[#080C1A] overflow-hidden"
        style={{
          top: 'calc(var(--banner-height, 0px) + var(--inactive-banner-height, 0px) + var(--wallet-banner-height, 0px))',
          borderRight: '1px solid transparent',
          backgroundImage: 'linear-gradient(#080C1A, #080C1A), linear-gradient(to bottom, rgba(212,168,83,0.15), transparent 60%)',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
          boxShadow: isExpanded ? 'var(--shadow-xl)' : 'none',
        }}
      >
        <Link
          href="/dashboard"
          className="flex items-center justify-center h-14 flex-shrink-0"
        >
          <Image src="/gold-logo.svg" alt="Logo" width={28} height={28} />
        </Link>
        {sidebarContent}
        {userSection}
      </motion.aside>
    </>
  )
}
