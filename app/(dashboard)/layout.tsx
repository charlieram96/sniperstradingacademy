import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { GlobalBanner } from "@/components/global-banner"
import { InactiveAccountBanner } from "@/components/inactive-account-banner"
import { MissingWalletBanner } from "@/components/missing-wallet-banner"
import { Sidebar } from "@/components/sidebar"
import { PageTransition } from "@/components/motion/page-transition"

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

  // Get user role and activation status from database
  const { data: userData } = await supabase
    .from("users")
    .select("role, initial_payment_completed, bypass_initial_payment, bypass_subscription, is_active, last_payment_date, payout_wallet_address, referred_by")
    .eq("id", user.id)
    .single()

  const userRole = userData?.role
  const isAdminOrSuper = userRole === "admin" || userRole === "superadmin" || userRole === "superadmin+"
  const isSuperAdmin = userRole === "superadmin" || userRole === "superadmin+"
  const isSuperAdminPlus = userRole === "superadmin+"

  const hasInitialAccess = userData?.initial_payment_completed || userData?.bypass_initial_payment
  const hasSubscriptionAccess = userData?.is_active !== false || userData?.bypass_subscription
  const isActive = (hasInitialAccess && hasSubscriptionAccess) || isAdminOrSuper

  return (
    <div className="min-h-screen bg-background">
      {/* Global Banner */}
      <GlobalBanner />

      {/* Inactive Account Banner */}
      <InactiveAccountBanner
        lastPaymentDate={userData?.last_payment_date || null}
        bypassSubscription={userData?.bypass_subscription || false}
        isAdmin={isAdminOrSuper}
      />

      {/* Missing Wallet Banner */}
      <MissingWalletBanner
        payoutWalletAddress={userData?.payout_wallet_address || null}
        bypassSubscription={userData?.bypass_subscription || false}
        isAdmin={isAdminOrSuper}
      />

      <div className="flex">
        {/* Sidebar */}
        <Sidebar
          user={user}
          isActive={isActive}
          isAdminOrSuper={isAdminOrSuper}
          isSuperAdmin={isSuperAdmin}
          isSuperAdminPlus={isSuperAdminPlus}
        />

        {/* Header */}
        <DashboardHeader user={user} />

        {/* Main content */}
        <main
          className="flex-1 overflow-auto ml-0 lg:ml-[72px]"
          style={{ paddingTop: 'calc(var(--banner-height, 0px) + var(--inactive-banner-height, 0px) + var(--wallet-banner-height, 0px) + 56px)' }}
        >
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </main>
      </div>
    </div>
  )
}
