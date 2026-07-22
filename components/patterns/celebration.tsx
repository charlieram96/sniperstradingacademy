import * as React from "react"
import { Award, Check, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * One-shot celebration keyframes (moments.html). Rendered inline so the
 * components stay self-contained and server-safe; both animations use
 * `animation-fill-mode: both` and play exactly once (never loop). The global
 * reduced-motion rule in globals.css collapses them to their settled state.
 */
const KEYFRAMES = `
@keyframes celebration-medal-pop { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
@keyframes celebration-confetti-rise { from { opacity: 0; transform: translateY(16px) rotate(0deg); } 60% { opacity: 1; } to { opacity: 1; transform: translateY(0) rotate(28deg); } }
`

const medalPop: React.CSSProperties = {
  animation: "celebration-medal-pop var(--dur-enter) var(--ease-spring) both",
}

// 12 confetti dots — position, token color and stagger (moments.html · 01).
const CONFETTI: { left: string; top: string; color: string; delay: number }[] = [
  { left: "9%", top: "24%", color: "var(--gold-300)", delay: 60 },
  { left: "20%", top: "12%", color: "var(--emerald)", delay: 150 },
  { left: "30%", top: "30%", color: "var(--gold-200)", delay: 230 },
  { left: "41%", top: "9%", color: "var(--blue-400)", delay: 110 },
  { left: "52%", top: "22%", color: "var(--gold-400)", delay: 300 },
  { left: "60%", top: "11%", color: "var(--gold-100)", delay: 190 },
  { left: "69%", top: "28%", color: "var(--emerald)", delay: 340 },
  { left: "78%", top: "15%", color: "var(--gold-300)", delay: 90 },
  { left: "87%", top: "26%", color: "var(--blue-400)", delay: 270 },
  { left: "15%", top: "40%", color: "var(--gold-200)", delay: 210 },
  { left: "73%", top: "40%", color: "var(--gold-400)", delay: 380 },
  { left: "47%", top: "38%", color: "var(--gold-100)", delay: 130 },
]

interface RankUpCardProps {
  rankName: string
  description?: React.ReactNode
  className?: string
}

/** Rank-up hero: gold wash + one-shot confetti + popping medallion (moments.html · 01). */
export function RankUpCard({ rankName, description, className }: RankUpCardProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-[300px] flex-col items-center justify-center gap-4 overflow-hidden rounded-[10px] border px-[34px] py-[38px] text-center shadow-[var(--sh-gold)]",
        className
      )}
      style={{
        borderColor: "color-mix(in srgb, var(--gold-400) 32%, transparent)",
        background:
          "radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, var(--gold-400) 22%, transparent), transparent 60%), linear-gradient(180deg, color-mix(in srgb, var(--gold-400) 6%, transparent), transparent 55%), var(--surface-0)",
      }}
    >
      <style>{KEYFRAMES}</style>

      <div className="pointer-events-none absolute inset-0 z-[1]">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="absolute h-[7px] w-[7px] rounded-[2px] opacity-0"
            style={{
              left: c.left,
              top: c.top,
              background: c.color,
              animation: `celebration-confetti-rise 620ms var(--ease-spring) both`,
              animationDelay: `${c.delay}ms`,
            }}
          />
        ))}
      </div>

      <div className="relative z-[2] font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-400">
        Rank up!
      </div>
      <span
        className="relative z-[2] flex h-12 w-12 items-center justify-center rounded-full text-gold-100 shadow-[var(--sh-gold)]"
        style={{
          background: "color-mix(in srgb, var(--gold-400) 20%, transparent)",
          borderColor: "color-mix(in srgb, var(--gold-400) 60%, transparent)",
          borderWidth: 1,
          ...medalPop,
        }}
      >
        <Award className="h-[26px] w-[26px]" strokeWidth={1.5} />
      </span>
      <h3 className="relative z-[2] text-[22px] font-semibold tracking-tight text-foreground">
        Rank up!
      </h3>
      <span
        className="relative z-[2] inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-mono text-xs font-semibold tracking-[0.04em] text-gold-200"
        style={{
          background: "color-mix(in srgb, var(--gold-400) 14%, transparent)",
          borderColor: "color-mix(in srgb, var(--gold-400) 40%, transparent)",
          borderWidth: 1,
        }}
      >
        <Award className="h-[13px] w-[13px]" strokeWidth={1.5} />
        {rankName}
      </span>
      <div className="relative z-[2] max-w-[320px] text-[12.5px] leading-relaxed tabular-nums text-foreground-secondary">
        {description ?? (
          <>
            You reached <b className="font-semibold text-foreground">{rankName}</b>. A new rate and
            the next milestone are unlocked.
          </>
        )}
      </div>
    </div>
  )
}

interface PayoutHeroProps {
  amount: string
  txHash: string
  network?: string
  description?: React.ReactNode
  explorerUrl?: string
  className?: string
}

/** Payout-received hero: emerald check + settled amount + transaction row (moments.html · 02). */
export function PayoutHero({
  amount,
  txHash,
  network = "Polygon",
  description,
  explorerUrl,
  className,
}: PayoutHeroProps) {
  return (
    <div
      className={cn(
        "flex min-h-[300px] flex-col items-center justify-center gap-[15px] rounded-[10px] border border-border bg-surface-0 px-[30px] py-8 text-center",
        className
      )}
    >
      <style>{KEYFRAMES}</style>

      <span
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-emerald"
        style={{
          background: "var(--emerald-dim)",
          borderColor: "color-mix(in srgb, var(--emerald) 40%, transparent)",
          borderWidth: 1,
          ...medalPop,
        }}
      >
        <Check className="h-[26px] w-[26px]" strokeWidth={1.5} />
      </span>
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald">
        Payout received
      </div>
      <div className="font-mono text-[32px] font-semibold tracking-tight tabular-nums text-foreground">
        {amount}{" "}
        <span className="text-base font-semibold text-foreground-secondary">USDC sent</span>
      </div>
      <div className="max-w-[300px] text-[12.5px] leading-relaxed text-foreground-secondary">
        {description ?? "Your commission settled to your wallet. Funds are available now."}
      </div>
      <div className="mt-0.5 inline-flex items-center gap-2.5 rounded-md border border-border bg-surface-2 px-[13px] py-2 font-mono text-[11.5px] tabular-nums text-foreground-secondary">
        <span className="tracking-[0.04em] text-foreground-tertiary">TX</span>
        <span className="font-semibold text-foreground">{txHash}</span>
        <span className="font-semibold text-gold-400">{network}</span>
      </div>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-[34px] items-center gap-[7px] px-4 text-[12.5px] font-semibold text-foreground-secondary transition-colors hover:text-foreground"
        >
          <ExternalLink className="h-[15px] w-[15px] text-foreground-tertiary" strokeWidth={1.5} />
          View on {network}scan
        </a>
      )}
    </div>
  )
}
