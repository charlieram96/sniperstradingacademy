"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, AlertTriangle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { calculateChildPositions, formatNetworkPositionId } from "@/lib/network-positions"

interface BasicUser {
  id: string
  name: string | null
  email: string | null
  network_position_id: string
  network_level: number
  network_position: number
}

interface ChildSlot {
  positionId: string
  position: number
  branch: 1 | 2 | 3
  occupied: boolean
  user: { name: string | null; email: string | null } | null
}

interface Ancestor {
  id: string
  name: string | null
  email: string | null
  network_position_id: string
  network_level: number
  network_position: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetUser: {
    id: string
    name: string | null
    email: string | null
    network_position_id: string
    network_level: number
    network_position: number
    tree_parent_network_position_id: string | null
    referred_by: string | null
    referrer: Array<{ name: string | null; network_position_id: string | null }> | null
  }
  onSuccess: () => void
}

const ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "You don't have permission to reassign positions.",
  SELF_REASSIGN: "You cannot reassign your own position.",
  TARGET_NOT_FOUND: "Target user not found.",
  USER_HAS_DOWNLINE: "User has downline members and cannot be moved.",
  INVALID_SLOT: "Invalid slot. Pick 1, 2, or 3.",
  PARENT_NOT_FOUND: "New parent not found.",
  NOOP: "New position is the same as the current one.",
  SLOT_OCCUPIED: "That slot is already occupied.",
  SPONSOR_NOT_ANCESTOR: "Sponsor must be on the upline chain of the new position.",
}

export function ReassignPositionDialog({ open, onOpenChange, targetUser, onSuccess }: Props) {
  const { toast } = useToast()

  const [search, setSearch] = useState("")
  const [results, setResults] = useState<BasicUser[]>([])
  const [searching, setSearching] = useState(false)
  const [newParent, setNewParent] = useState<BasicUser | null>(null)

  const [slots, setSlots] = useState<ChildSlot[] | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<"1" | "2" | "3" | null>(null)

  const [ancestors, setAncestors] = useState<Ancestor[]>([])
  const [loadingAncestors, setLoadingAncestors] = useState(false)
  const [newSponsor, setNewSponsor] = useState<string>("__unchanged__")

  const [reason, setReason] = useState("")
  const [confirmText, setConfirmText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetState = useCallback(() => {
    setSearch("")
    setResults([])
    setNewParent(null)
    setSlots(null)
    setSelectedSlot(null)
    setAncestors([])
    setNewSponsor("__unchanged__")
    setReason("")
    setConfirmText("")
  }, [])

  useEffect(() => {
    if (!open) resetState()
  }, [open, resetState])

  // Debounced user search
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    if (!search || search.length < 2) {
      setResults([])
      return
    }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(search)}`)
        const data = await res.json()
        const filtered: BasicUser[] = (data.users ?? [])
          .filter((u: BasicUser) => u.network_position_id && u.id !== targetUser.id)
        setResults(filtered)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current)
    }
  }, [search, targetUser.id])

  // When a new parent is chosen, fetch child slot occupancy + ancestor list
  useEffect(() => {
    if (!newParent) {
      setSlots(null)
      setSelectedSlot(null)
      setAncestors([])
      setNewSponsor("__unchanged__")
      return
    }

    const parentPosId = newParent.network_position_id

    setLoadingSlots(true)
    fetch(`/api/admin/network/children?positionId=${parentPosId}`)
      .then(r => r.json())
      .then(data => {
        const children: ChildSlot[] = data.children ?? []
        setSlots(children)
        const firstEmpty = children.find(c => !c.occupied)
        setSelectedSlot(firstEmpty ? (String(firstEmpty.branch) as "1" | "2" | "3") : null)
      })
      .catch(() => setSlots(null))
      .finally(() => setLoadingSlots(false))

    setLoadingAncestors(true)
    fetch(`/api/admin/network/ancestors?positionId=${parentPosId}`)
      .then(r => r.json())
      .then(data => setAncestors(data.ancestors ?? []))
      .catch(() => setAncestors([]))
      .finally(() => setLoadingAncestors(false))
  }, [newParent])

  const projectedPosition = useMemo(() => {
    if (!newParent || !selectedSlot) return null
    const slotNum = Number(selectedSlot)
    const childPositions = calculateChildPositions(newParent.network_position)
    const newPositionNum = childPositions[slotNum - 1]
    return {
      id: formatNetworkPositionId(newParent.network_level + 1, newPositionNum),
      level: newParent.network_level + 1,
      position: newPositionNum,
    }
  }, [newParent, selectedSlot])

  const canSubmit = useMemo(() => {
    if (!newParent || !selectedSlot) return false
    if (confirmText !== "REASSIGN") return false
    const slotState = slots?.find(s => s.branch === Number(selectedSlot))
    if (slotState?.occupied) return false
    if (projectedPosition?.id === targetUser.network_position_id) return false
    return true
  }, [newParent, selectedSlot, confirmText, slots, projectedPosition, targetUser.network_position_id])

  const onSubmit = async () => {
    if (!newParent || !selectedSlot) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/users/reassign-position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUser.id,
          newTreeParentPositionId: newParent.network_position_id,
          slot: Number(selectedSlot),
          newReferredBy: newSponsor === "__unchanged__" ? null : newSponsor,
          reason: reason.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data?.success) {
        const code = data?.error as string | undefined
        toast({
          title: "Reassign failed",
          description: (code && ERROR_MESSAGES[code]) || data?.error || "Unexpected error",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Position reassigned",
        description: `${targetUser.name || targetUser.email} moved to ${data.new_position_id}.`,
      })
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast({
        title: "Reassign failed",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const currentTreeParentLabel = targetUser.tree_parent_network_position_id ?? "—"
  const currentSponsor = targetUser.referrer?.[0]

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Reassign Network Position</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <div className="bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-yellow-300">
                  Destructive admin action. Counters on the old and new upline chains will be adjusted atomically.
                  An audit row is written to <code className="font-mono">network_position_reassignments</code>.
                </div>
              </div>
            </div>

            {/* Current state */}
            <div className="p-3 rounded-lg bg-surface-2 text-sm space-y-1">
              <div className="font-semibold">{targetUser.name || targetUser.email}</div>
              <div className="text-muted-foreground text-xs">{targetUser.email}</div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="outline" className="font-mono text-xs">{targetUser.network_position_id}</Badge>
                <span className="text-xs text-muted-foreground">Level {targetUser.network_level}</span>
              </div>
              <div className="text-xs text-muted-foreground pt-1">
                Current parent: <span className="font-mono">{currentTreeParentLabel}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Current sponsor: {currentSponsor?.name || "—"}
              </div>
            </div>

            {/* New parent search */}
            <div className="space-y-2">
              <Label htmlFor="new-parent-search">New tree parent</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-parent-search"
                  className="pl-8"
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setNewParent(null)
                  }}
                  disabled={submitting}
                />
              </div>
              {newParent ? (
                <div className="p-2 rounded border border-border-subtle flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{newParent.name || newParent.email}</div>
                    <div className="text-xs text-muted-foreground font-mono">{newParent.network_position_id} • L{newParent.network_level}</div>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={() => setNewParent(null)}
                  >
                    change
                  </button>
                </div>
              ) : (
                <>
                  {searching && <div className="text-xs text-muted-foreground">Searching…</div>}
                  {!searching && results.length > 0 && (
                    <div className="max-h-40 overflow-y-auto border border-border-subtle rounded">
                      {results.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { setNewParent(u); setSearch("") }}
                          className="w-full text-left px-3 py-2 hover:bg-surface-2 border-b border-border-subtle last:border-b-0 text-sm"
                        >
                          <div className="font-medium">{u.name || u.email}</div>
                          <div className="text-xs text-muted-foreground font-mono">{u.network_position_id} • L{u.network_level}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Slot picker */}
            {newParent && (
              <div className="space-y-2">
                <Label>Slot under new parent</Label>
                {loadingSlots ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading slots…
                  </div>
                ) : slots ? (
                  <RadioGroup
                    value={selectedSlot ?? ""}
                    onValueChange={(v) => setSelectedSlot(v as "1" | "2" | "3")}
                    className="grid grid-cols-1 gap-2"
                  >
                    {slots.map(slot => {
                      const idKey = `slot-${slot.branch}`
                      return (
                        <div
                          key={slot.positionId}
                          className={`flex items-center gap-3 p-2 rounded border ${slot.occupied ? "border-border-subtle opacity-60" : "border-border-subtle"}`}
                        >
                          <RadioGroupItem id={idKey} value={String(slot.branch)} disabled={slot.occupied} />
                          <Label htmlFor={idKey} className={`flex-1 cursor-pointer ${slot.occupied ? "cursor-not-allowed" : ""}`}>
                            <div className="text-sm font-medium">Slot {slot.branch}</div>
                            <div className="text-xs text-muted-foreground font-mono">{slot.positionId}</div>
                            <div className="text-xs text-muted-foreground">
                              {slot.occupied ? `Occupied by ${slot.user?.name || slot.user?.email || "(unknown)"}` : "Empty"}
                            </div>
                          </Label>
                        </div>
                      )
                    })}
                  </RadioGroup>
                ) : (
                  <div className="text-xs text-destructive">Failed to load slots.</div>
                )}
              </div>
            )}

            {/* Sponsor */}
            {newParent && (
              <div className="space-y-2">
                <Label>Sponsor (optional)</Label>
                {loadingAncestors ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading ancestors…
                  </div>
                ) : (
                  <Select value={newSponsor} onValueChange={setNewSponsor} disabled={submitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Leave unchanged" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unchanged__">Leave unchanged</SelectItem>
                      {ancestors.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {(a.name || a.email) ?? "(unnamed)"} — {a.network_position_id} (L{a.network_level})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  Sponsor must be on the upline chain of the new position.
                </p>
              </div>
            )}

            {/* Projected new position */}
            {projectedPosition && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm">
                <div className="text-xs text-blue-300 mb-1">New position preview</div>
                <div className="font-mono text-blue-200">{projectedPosition.id}</div>
                <div className="text-xs text-muted-foreground">L{projectedPosition.level} • Pos {projectedPosition.position}</div>
              </div>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reassign-reason">Reason (optional)</Label>
              <Textarea
                id="reassign-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this user being reassigned?"
                rows={2}
                disabled={submitting}
              />
            </div>

            {/* Typed confirm */}
            <div className="space-y-2">
              <Label htmlFor="reassign-confirm">Type REASSIGN to confirm</Label>
              <Input
                id="reassign-confirm"
                className="font-mono"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="REASSIGN"
                disabled={submitting}
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onSubmit() }}
            disabled={!canSubmit || submitting}
          >
            {submitting ? "Reassigning…" : "Reassign"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
