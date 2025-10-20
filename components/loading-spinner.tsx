"use client"

import Image from "next/image"

export function LoadingSpinner() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative animate-gentle-pulse">
        <Image 
          src="/gold-logo.svg" 
          alt="Loading..." 
          width={80} 
          height={80}
          className="animate-fast-spin"
        />
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl"></div>
      </div>
    </div>
  )
}