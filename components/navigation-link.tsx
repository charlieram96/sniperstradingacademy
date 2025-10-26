"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useLoading } from "./loading-provider"
import { MouseEvent, ReactNode } from "react"
import { Lock } from "lucide-react"

interface NavigationLinkProps {
  href: string
  children: ReactNode
  className?: string
  onClick?: () => void
  isLocked?: boolean
}

export function NavigationLink({ href, children, className, onClick, isLocked = false }: NavigationLinkProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { setIsLoading } = useLoading()

  const isActive = pathname === href

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()

    // Prevent navigation if locked
    if (isLocked) {
      return
    }

    // Call custom onClick if provided
    if (onClick) {
      onClick()
    }

    // Don't trigger loading if we're already on the same page
    if (pathname === href) {
      return
    }

    // Set loading state before navigation
    setIsLoading(true)

    // Small delay to show loading animation
    setTimeout(() => {
      router.push(href)
    }, 100)
  }

  // Combine base className with active state and locked state
  const combinedClassName = `${className} ${isActive ? 'bg-sidebar-accent' : ''} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`

  return (
    <Link href={href} onClick={handleClick} className={combinedClassName}>
      <div className="flex items-center justify-between w-full">
        {children}
        {isLocked && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
      </div>
    </Link>
  )
}