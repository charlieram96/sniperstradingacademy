import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { hasPrivilege } from "@/lib/admin/permissions"
import { PrivilegesManagerClient } from "./privileges-client"

export default async function PrivilegesPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role, permissions")
    .eq("id", user.id)
    .single()

  if (!hasPrivilege(userData?.role, userData?.permissions as string[] | null, "manage_privileges")) {
    redirect("/dashboard")
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Privileges Manager</h1>
        <p className="text-muted-foreground">
          Grant granular admin privileges and set base roles for users
        </p>
      </div>

      <PrivilegesManagerClient viewerRole={userData?.role ?? null} viewerId={user.id} />
    </div>
  )
}
