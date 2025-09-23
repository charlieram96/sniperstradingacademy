import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Share2,
  LogOut
} from "lucide-react"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  
  if (!session) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white">
        <div className="p-6">
          <h1 className="text-2xl font-bold">Trading Hub</h1>
          <p className="text-sm text-gray-400 mt-1">Options Traders Network</p>
        </div>
        
        <nav className="mt-8">
          <Link 
            href="/dashboard"
            className="flex items-center px-6 py-3 hover:bg-gray-800 transition-colors"
          >
            <LayoutDashboard className="h-5 w-5 mr-3" />
            Dashboard
          </Link>
          <Link 
            href="/group"
            className="flex items-center px-6 py-3 hover:bg-gray-800 transition-colors"
          >
            <Users className="h-5 w-5 mr-3" />
            My Group
          </Link>
          <Link 
            href="/payments"
            className="flex items-center px-6 py-3 hover:bg-gray-800 transition-colors"
          >
            <CreditCard className="h-5 w-5 mr-3" />
            Payments
          </Link>
          <Link 
            href="/referrals"
            className="flex items-center px-6 py-3 hover:bg-gray-800 transition-colors"
          >
            <Share2 className="h-5 w-5 mr-3" />
            Referrals
          </Link>
        </nav>

        <div className="absolute bottom-0 w-64 p-6">
          <div className="border-t border-gray-800 pt-4">
            <p className="text-sm text-gray-400 mb-3">{session.user?.email}</p>
            <form action={async () => {
              "use server"
              const { signOut } = await import("@/lib/auth")
              await signOut({ redirectTo: "/" })
            }}>
              <Button 
                type="submit"
                variant="ghost" 
                className="w-full justify-start text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}