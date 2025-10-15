"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useLoading } from "./loading-provider"
import { MouseEvent, ReactNode } from "react"

interface NavigationLinkProps {
  href: string
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function NavigationLink({ href, children, className, onClick }: NavigationLinkProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { setIsLoading } = useLoading()

  const isActive = pathname === href

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()

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

  // Combine base className with active state
  const combinedClassName = `${className} ${isActive ? 'bg-sidebar-accent' : ''}`

  return (
    <Link href={href} onClick={handleClick} className={combinedClassName}>
      {children}
    </Link>
  )
}