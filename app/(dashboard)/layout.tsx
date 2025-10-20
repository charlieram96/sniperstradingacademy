import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SignOutButton } from "@/components/sign-out-button"
import { NavigationLink } from "@/components/navigation-link"
import { DashboardHeader } from "@/components/dashboard-header"
import { GlobalBanner } from "@/components/global-banner"
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
  Wallet
} from "lucide-react"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  // Get user role from database
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  const userRole = userData?.role
  const isAdminOrSuper = userRole === "admin" || userRole === "superadmin"
  const isSuperAdmin = userRole === "superadmin"

  return (
    <div className="min-h-screen bg-background">
      {/* Global Banner */}
      <GlobalBanner />

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col fixed h-full z-40 pt-[50px]">
        <nav className="flex-1 py-4 overflow-y-auto">
          <NavigationLink
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-2.5 mx-2 mb-[5px] rounded-md hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-200 group cursor-pointer"
          >
            <LayoutDashboard className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
            <span className="text-sm font-medium">Dashboard</span>
          </NavigationLink>
          <NavigationLink
            href="/academy"
            className="flex items-center gap-3 px-4 py-2.5 mx-2 mb-[5px] rounded-md hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-200 group cursor-pointer"
          >
            <GraduationCap className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
            <span className="text-sm font-medium">Academy</span>
          </NavigationLink>
          <NavigationLink
            href="/team"
            className="flex items-center gap-3 px-4 py-2.5 mx-2 mb-[5px] rounded-md hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-200 group cursor-pointer"
          >
            <Users className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
            <span className="text-sm font-medium">My Team</span>
          </NavigationLink>
          <NavigationLink
            href="/finance"
            className="flex items-center gap-3 px-4 py-2.5 mx-2 mb-[5px] rounded-md hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-200 group cursor-pointer"
          >
            <DollarSign className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
            <span className="text-sm font-medium">Finance</span>
          </NavigationLink>
          <NavigationLink
            href="/payments"
            className="flex items-center gap-3 px-4 py-2.5 mx-2 mb-[5px] rounded-md hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-200 group cursor-pointer"
          >
            <CreditCard className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
            <span className="text-sm font-medium">Payments</span>
          </NavigationLink>
          <NavigationLink
            href="/referrals"
            className="flex items-center gap-3 px-4 py-2.5 mx-2 mb-[5px] rounded-md hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-200 group cursor-pointer"
          >
            <Share2 className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
            <span className="text-sm font-medium">Referrals</span>
          </NavigationLink>

          {/* Admin Section */}
          {isAdminOrSuper && (
            <>
              <div className="mx-4 my-3 border-t border-sidebar-border"></div>
              <div className="px-4 py-2 mx-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</p>
              </div>
              <NavigationLink
                href="/admin/classes"
                className="flex items-center gap-3 px-4 py-2.5 mx-2 mb-[5px] rounded-md hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-200 group cursor-pointer"
              >
                <Shield className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
                <span className="text-sm font-medium">Admin Panel</span>
              </NavigationLink>
              <NavigationLink
                href="/admin/network"
                className="flex items-center gap-3 px-4 py-2.5 mx-2 mb-[5px] rounded-md hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-200 group cursor-pointer"
              >
                <Network className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
                <span className="text-sm font-medium">Network View</span>
              </NavigationLink>
              {isSuperAdmin && (
                <>
                  <NavigationLink
                    href="/admin/financials"
                    className="flex items-center gap-3 px-4 py-2.5 mx-2 mb-[5px] rounded-md hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-200 group cursor-pointer"
                  >
                    <TrendingUp className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
                    <span className="text-sm font-medium">Financials</span>
                  </NavigationLink>
                  <NavigationLink
                    href="/admin/payouts"
                    className="flex items-center gap-3 px-4 py-2.5 mx-2 mb-[5px] rounded-md hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-accent-foreground transition-all duration-200 group cursor-pointer"
                  >
                    <Wallet className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary" />
                    <span className="text-sm font-medium">Payouts</span>
                  </NavigationLink>
                </>
              )}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white text-sm font-medium shadow-lg shadow-red-900/50">
              {user.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user.user_metadata?.name || "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Header */}
      <DashboardHeader user={user} />

      {/* Main content */}
      <main className="flex-1 overflow-auto ml-64 pt-[50px]">
        <div className="p-8">
          {children}
        </div>
      </main>
      </div>
    </div>
  )
}