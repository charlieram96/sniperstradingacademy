"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Shield, Loader2, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  ADMIN_PRIVILEGES,
  ASSIGNABLE_ROLES,
  roleImpliesPrivilege,
  type AdminRole,
  type PrivilegeKey,
} from "@/lib/admin/permissions"

interface SearchUser {
  id: string
  name: string | null
  email: string | null
}

interface SelectedUser {
  id: string
  name: string | null
  email: string | null
  role: AdminRole
  permissions: PrivilegeKey[]
}

export function PrivilegesManagerClient() {
  const { toast } = useToast()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SelectedUser | null>(null)
  const [role, setRole] = useState<AdminRole>("user")
  const [grants, setGrants] = useState<Set<PrivilegeKey>>(new Set())
  const [loadingUser, setLoadingUser] = useState(false)
  const [saving, setSaving] = useState(false)

  const search = async () => {
    if (query.trim().length < 2) return
    setSearching(true)
    try {
      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      setResults(data.users || [])
    } catch {
      toast({ title: "Search failed", variant: "destructive" })
    } finally {
      setSearching(false)
    }
  }

  const selectUser = async (u: SearchUser) => {
    setLoadingUser(true)
    try {
      const res = await fetch(`/api/admin/users/update-privileges?userId=${u.id}`)
      if (!res.ok) throw new Error()
      const { user } = await res.json()
      const userRole = (user.role as AdminRole) || "user"
      const userPerms = (user.permissions as PrivilegeKey[]) || []
      setSelected({ id: user.id, name: user.name, email: user.email, role: userRole, permissions: userPerms })
      setRole(userRole)
      setGrants(new Set(userPerms))
    } catch {
      toast({ title: "Failed to load user", variant: "destructive" })
    } finally {
      setLoadingUser(false)
    }
  }

  const toggleGrant = (key: PrivilegeKey, on: boolean) => {
    setGrants((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      // Store only explicit grants that the chosen role does not already imply
      const explicit = Array.from(grants).filter((k) => !roleImpliesPrivilege(role, k))
      const res = await fetch("/api/admin/users/update-privileges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.id, role, permissions: explicit }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      toast({ title: "Privileges updated", description: `${selected.name || selected.email} saved.` })
      setSelected({ ...selected, role, permissions: explicit })
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find a user</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                className="pl-8"
              />
            </div>
            <Button onClick={search} disabled={searching || query.trim().length < 2}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-1">
              {results.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUser(u)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors hover:bg-accent-hover ${
                    selected?.id === u.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{u.name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  {selected?.id === u.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor */}
      {loadingUser ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading user…
        </div>
      ) : selected ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{selected.name || "Unknown"}</CardTitle>
                  <p className="text-xs text-muted-foreground">{selected.email}</p>
                </div>
              </div>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save changes
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Base role */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Base role</p>
                <p className="text-xs text-muted-foreground">
                  Higher roles implicitly include lower-tier privileges
                </p>
              </div>
              <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Granular privileges */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Granular privileges</p>
              <div className="space-y-2">
                {ADMIN_PRIVILEGES.map((priv) => {
                  const impliedByRole = roleImpliesPrivilege(role, priv.key)
                  const checked = impliedByRole || grants.has(priv.key)
                  return (
                    <div
                      key={priv.key}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div className="min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{priv.label}</p>
                          {impliedByRole && (
                            <Badge variant="outline" className="text-[10px]">via role</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{priv.description}</p>
                      </div>
                      <Switch
                        checked={checked}
                        disabled={impliedByRole}
                        onCheckedChange={(on) => toggleGrant(priv.key, on)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
