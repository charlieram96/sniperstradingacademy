"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Compass,
  ChevronRight,
  UserPlus,
  Mail,
  UserCheck,
  CheckCircle2,
  CircleSlash,
  CornerDownRight,
  Loader2,
} from "lucide-react"

interface TreeChild {
  child_id: string | null
  child_name: string
  child_email: string | null
  child_position_id: string
  child_slot_number: number
  is_filled: boolean
  is_direct_referral: boolean
}

interface FocusNode {
  id: string
  name: string | null
  email: string | null
  is_active: boolean
  network_position_id: string | null
  active_direct_referrals_count: number | null
  active_network_count: number | null
  total_network_count: number | null
}

interface Crumb {
  id: string
  name: string
}

interface TeamExplorerProps {
  rootUserId: string
}

function initials(name: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")
}

export function TeamExplorer({ rootUserId }: TeamExplorerProps) {
  const [path, setPath] = useState<Crumb[]>([{ id: rootUserId, name: "You" }])
  const [focus, setFocus] = useState<FocusNode | null>(null)
  const [slots, setSlots] = useState<TreeChild[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const focusId = path[path.length - 1].id
  const isRoot = path.length === 1

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/network/tree-children?userId=${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to load")
      setFocus(data.focus)
      setSlots(data.treeChildren || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
      setFocus(null)
      setSlots([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(focusId)
  }, [focusId, load])

  const drillInto = (child: TreeChild) => {
    if (!child.is_filled || !child.child_id) return
    setPath((p) => [...p, { id: child.child_id as string, name: child.child_name || "Member" }])
  }

  const jumpTo = (index: number) => {
    if (index === path.length - 1) return
    setPath((p) => p.slice(0, index + 1))
  }

  const focusName = isRoot ? "You" : focus?.name || "Member"
  const filledCount = slots.filter((s) => s.is_filled).length

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-primary" />
          Explore Your Team
        </CardTitle>
        <CardDescription>
          Walk through the structure below you. Open a member to see their three positions, then drill in to keep going.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Breadcrumb trail */}
        <div className="flex flex-wrap items-center gap-1.5 mb-6">
          {path.map((crumb, i) => {
            const isLast = i === path.length - 1
            return (
              <div key={`${crumb.id}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
                <button
                  type="button"
                  onClick={() => jumpTo(i)}
                  disabled={isLast}
                  className={`text-sm px-2.5 py-1 rounded-full border transition-colors ${
                    isLast
                      ? "bg-primary/10 text-primary border-primary/30 font-medium cursor-default"
                      : "bg-surface-1 text-muted-foreground border-border hover:text-foreground hover:border-border-accent cursor-pointer"
                  }`}
                >
                  {i === 0 ? "You" : crumb.name}
                </button>
              </div>
            )
          })}
        </div>

        {error ? (
          <div className="flex items-center gap-2 text-sm text-destructive py-8 justify-center">
            <CircleSlash className="h-4 w-4" /> {error}
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 lg:gap-0">
            {/* ── Focus card (left) ── */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`focus-${focusId}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
                className="lg:w-72 lg:flex-shrink-0"
              >
                <div className="h-full rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 via-surface-1 to-surface-1 p-5 shadow-[0_0_0_1px_rgba(212,168,83,0.06)]">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div
                        className={`h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold uppercase ${
                          focus?.is_active || isRoot
                            ? "bg-primary text-primary-foreground"
                            : "bg-surface-2 text-muted-foreground"
                        }`}
                      >
                        {isRoot ? <UserCheck className="h-6 w-6" /> : initials(focus?.name ?? null)}
                      </div>
                      {!isRoot && (
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-surface-1 ${
                            focus?.is_active ? "bg-emerald-500" : "bg-muted-foreground/40"
                          }`}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{focusName}</p>
                      {!isRoot && (
                        <Badge
                          className={`mt-1 text-[10px] ${
                            focus?.is_active
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-surface-2 text-muted-foreground border-border"
                          }`}
                        >
                          {focus?.is_active ? "Active" : "Inactive"}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {loading && !focus ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{focus?.email || "—"}</span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-surface-2/60 px-3 py-2">
                          <div className="text-base font-bold text-foreground leading-none">
                            {focus?.active_direct_referrals_count ?? 0}
                          </div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                            Active directs
                          </div>
                        </div>
                        <div className="rounded-lg bg-surface-2/60 px-3 py-2">
                          <div className="text-base font-bold text-foreground leading-none">
                            {focus?.active_network_count ?? 0}
                          </div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                            Active network
                          </div>
                        </div>
                      </div>

                      {focus?.network_position_id && (
                        <p className="mt-3 text-[10px] font-mono text-muted-foreground/70 truncate">
                          {focus.network_position_id}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* ── Connector (md+) ── */}
            <div className="hidden lg:flex items-center px-3" aria-hidden>
              <div className="flex flex-col items-center text-muted-foreground/40">
                <CornerDownRight className="h-4 w-4" />
                <div className="text-[10px] mt-1 font-medium tracking-wide">
                  {filledCount}/3
                </div>
              </div>
            </div>

            {/* ── Slots (right) ── */}
            <div className="flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`slots-${focusId}`}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0 }}
                  variants={{
                    hidden: {},
                    visible: { transition: { staggerChildren: 0.06 } },
                  }}
                  className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3"
                >
                  {(loading ? Array.from({ length: 3 }) : slots).map((raw, idx) => {
                    const slot = raw as TreeChild | undefined
                    const slotNo = slot?.child_slot_number ?? idx + 1
                    const filled = !!slot?.is_filled

                    return (
                      <motion.div
                        key={slot?.child_position_id ?? `skeleton-${idx}`}
                        variants={{
                          hidden: { opacity: 0, x: 18 },
                          visible: { opacity: 1, x: 0 },
                        }}
                        transition={{ duration: 0.22 }}
                      >
                        {loading ? (
                          <div className="h-[72px] rounded-xl border border-border bg-surface-1 animate-pulse" />
                        ) : filled ? (
                          <button
                            type="button"
                            onClick={() => drillInto(slot as TreeChild)}
                            className={`group w-full text-left flex items-center gap-3 rounded-xl border p-3.5 transition-all hover:-translate-y-0.5 ${
                              slot?.is_direct_referral
                                ? "bg-primary/[0.06] border-primary/40 hover:border-primary"
                                : "bg-surface-1 border-border hover:border-border-accent"
                            }`}
                          >
                            <div
                              className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold uppercase flex-shrink-0 ${
                                slot?.is_direct_referral
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-surface-2 text-foreground"
                              }`}
                            >
                              {initials(slot?.child_name ?? null)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm truncate">{slot?.child_name}</p>
                                <Badge
                                  className={`text-[9px] px-1.5 py-0 flex-shrink-0 ${
                                    slot?.is_direct_referral
                                      ? "bg-primary/10 text-primary border-primary/20"
                                      : "bg-surface-2 text-muted-foreground border-border"
                                  }`}
                                >
                                  {slot?.is_direct_referral ? "Direct" : "Spillover"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{slot?.child_email || "—"}</p>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground/50 flex-shrink-0">
                              <span className="text-[10px] font-mono">#{slotNo}</span>
                              <ChevronRight className="h-4 w-4 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </button>
                        ) : (
                          <div className="flex items-center gap-3 rounded-xl border border-dashed border-muted-foreground/25 bg-background p-3.5">
                            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-surface-1 flex-shrink-0">
                              <UserPlus className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground">Open position</p>
                              <p className="text-xs text-muted-foreground/60">Fills automatically as the team grows</p>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground/40">#{slotNo}</span>
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </motion.div>
              </AnimatePresence>

              {!loading && filledCount === 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3 justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  No one is placed below {isRoot ? "you" : focusName} yet.
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
