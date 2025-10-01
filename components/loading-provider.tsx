"use client"

import { createContext, useContext, useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { LoadingSpinner } from "./loading-spinner"

interface LoadingContextType {
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

const LoadingContext = createContext<LoadingContextType>({
  isLoading: false,
  setIsLoading: () => {},
})

export function useLoading() {
  return useContext(LoadingContext)
}

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const pathname = usePathname()
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Skip loading spinner on initial page load
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    // Start loading when pathname changes
    setIsLoading(true)

    // Stop loading after a short delay
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [pathname])

  return (
    <LoadingContext.Provider value={{ isLoading, setIsLoading }}>
      {isLoading && <LoadingSpinner />}
      {children}
    </LoadingContext.Provider>
  )
}